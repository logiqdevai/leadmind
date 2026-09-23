import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type Provider from 'oidc-provider';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OidcProviderService } from '../services/oidc-provider.service';
import { OAuthConnectionsService } from '../services/oauth-connections.service';
import {
  buildAccountId,
  parseAccountId,
  ALL_SCOPES,
  SCOPE_DESCRIPTIONS,
  OAuthScope,
} from '../oauth.constants';
import { InteractionLoginDto } from './dto/interaction-login.dto';
import { InteractionSelectOrganisationDto } from './dto/interaction-select-organisation.dto';
import {
  consentPage,
  errorPage,
  loginPage,
  organisationPickerPage,
} from './interaction.templates';

const LOGIN_TOKEN_PURPOSE = 'oauth_interaction_login';
const LOGIN_TOKEN_TTL = '5m';

type InteractionDetails = Awaited<ReturnType<Provider['interactionDetails']>>;

@Injectable()
export class OAuthInteractionService {
  private readonly logger = new Logger(OAuthInteractionService.name);

  constructor(
    private readonly oidc: OidcProviderService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly connections: OAuthConnectionsService,
  ) {}

  async render(req: Request, res: Response): Promise<void> {
    const interaction = await this.oidc.provider.interactionDetails(req, res);

    if (interaction.prompt.name === 'login') {
      this.sendHtml(res, loginPage({ uid: interaction.uid }));
      return;
    }

    if (interaction.prompt.name === 'consent') {
      await this.renderConsent(interaction, res);
      return;
    }

    this.sendHtml(
      res,
      errorPage(`Unsupported interaction step: ${interaction.prompt.name}`),
      400,
    );
  }

  async submitLogin(
    req: Request,
    res: Response,
    uid: string,
    dto: InteractionLoginDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const passwordValid = user?.password
      ? await bcrypt.compare(dto.password, user.password)
      : false;

    if (!user || !passwordValid) {
      this.sendHtml(
        res,
        loginPage({
          uid,
          email: dto.email,
          error: 'Invalid email or password',
        }),
      );
      return;
    }

    const memberships = await this.prisma.organisationMember.findMany({
      where: { user_uuid: user.uuid },
      include: { organisation: true },
      orderBy: { updated_at: 'desc' },
    });

    if (memberships.length === 0) {
      this.sendHtml(
        res,
        errorPage('Your account is not a member of any workspace yet.'),
        400,
      );
      return;
    }

    if (memberships.length === 1) {
      await this.finishLogin(
        req,
        res,
        user.uuid,
        memberships[0].organisation_uuid,
      );
      return;
    }

    const loginToken = await this.jwtService.signAsync(
      { purpose: LOGIN_TOKEN_PURPOSE, uid, user_uuid: user.uuid },
      { secret: this.config.get('JWT_SECRET'), expiresIn: LOGIN_TOKEN_TTL },
    );

    this.sendHtml(
      res,
      organisationPickerPage({
        uid,
        loginToken,
        organisations: memberships.map((m) => ({
          uuid: m.organisation_uuid,
          name: m.organisation.name,
        })),
      }),
    );
  }

  async submitOrganisationSelection(
    req: Request,
    res: Response,
    uid: string,
    dto: InteractionSelectOrganisationDto,
  ): Promise<void> {
    let payload: { purpose: string; uid: string; user_uuid: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.login_token, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      this.sendHtml(
        res,
        errorPage('Your sign-in session expired. Please start again.'),
        400,
      );
      return;
    }

    if (payload.purpose !== LOGIN_TOKEN_PURPOSE || payload.uid !== uid) {
      this.sendHtml(res, errorPage('Invalid sign-in session.'), 400);
      return;
    }

    const membership = await this.prisma.organisationMember.findUnique({
      where: {
        organisation_uuid_user_uuid: {
          organisation_uuid: dto.organisation_uuid,
          user_uuid: payload.user_uuid,
        },
      },
    });

    if (!membership) {
      this.sendHtml(
        res,
        errorPage('You are not a member of that workspace.'),
        400,
      );
      return;
    }

    await this.finishLogin(req, res, payload.user_uuid, dto.organisation_uuid);
  }

  async confirmConsent(req: Request, res: Response): Promise<void> {
    const interaction = await this.oidc.provider.interactionDetails(req, res);
    const { session, params, grantId, prompt } = interaction;

    if (!session?.accountId) {
      this.sendHtml(
        res,
        errorPage('Your session expired. Please start again.'),
        400,
      );
      return;
    }

    const grant = grantId
      ? await this.oidc.provider.Grant.find(grantId)
      : new this.oidc.provider.Grant({
          accountId: session.accountId,
          clientId: params.client_id as string,
        });

    if (!grant) {
      this.sendHtml(
        res,
        errorPage('Your session expired. Please start again.'),
        400,
      );
      return;
    }

    const missingOIDCScope = prompt.details.missingOIDCScope as
      | string[]
      | undefined;
    if (missingOIDCScope?.length) {
      grant.addOIDCScope(missingOIDCScope.join(' '));
    }

    const missingResourceScopes = prompt.details.missingResourceScopes as
      | Record<string, string[]>
      | undefined;
    if (missingResourceScopes) {
      for (const [indicator, scopes] of Object.entries(missingResourceScopes)) {
        grant.addResourceScope(indicator, scopes.join(' '));
      }
    }

    const newGrantId = await grant.save();

    const parsed = parseAccountId(session.accountId);
    if (parsed) {
      const client = await this.oidc.provider.Client.find(
        params.client_id as string,
      );
      await this.connections.recordGrant({
        organisationUuid: parsed.organisationUuid,
        grantedByUserUuid: parsed.userUuid,
        oauthClientId: params.client_id as string,
        grantId: newGrantId,
        clientName: client?.clientName,
        clientUri: client?.clientUri,
        scope: (params.scope as string) ?? grant.getOIDCScope(),
      });
    }

    await this.oidc.provider.interactionFinished(
      req,
      res,
      { consent: grantId ? {} : { grantId: newGrantId } },
      { mergeWithLastSubmission: true },
    );
  }

  async abortConsent(req: Request, res: Response): Promise<void> {
    await this.oidc.provider.interactionFinished(
      req,
      res,
      {
        error: 'access_denied',
        error_description:
          'End-User denied access to the requesting application',
      },
      { mergeWithLastSubmission: false },
    );
  }

  private async finishLogin(
    req: Request,
    res: Response,
    userUuid: string,
    organisationUuid: string,
  ): Promise<void> {
    const accountId = buildAccountId(userUuid, organisationUuid);
    await this.oidc.provider.interactionFinished(
      req,
      res,
      { login: { accountId } },
      { mergeWithLastSubmission: false },
    );
  }

  private async renderConsent(interaction: InteractionDetails, res: Response) {
    const { params, session, uid } = interaction;
    const parsed = session?.accountId
      ? parseAccountId(session.accountId)
      : undefined;

    if (!parsed) {
      this.sendHtml(
        res,
        errorPage('Your session expired. Please start again.'),
        400,
      );
      return;
    }

    const [client, organisation] = await Promise.all([
      this.oidc.provider.Client.find(params.client_id as string),
      this.prisma.organisation.findUnique({
        where: { uuid: parsed.organisationUuid },
      }),
    ]);

    const requestedScopes = String(params.scope ?? '')
      .split(' ')
      .filter((scope): scope is OAuthScope =>
        (ALL_SCOPES as readonly string[]).includes(scope),
      );

    this.sendHtml(
      res,
      consentPage({
        uid,
        clientName:
          client?.clientName || client?.clientId || 'This application',
        clientUri: client?.clientUri,
        organisationName: organisation?.name ?? 'your workspace',
        scopeDescriptions: requestedScopes.map(
          (scope) => SCOPE_DESCRIPTIONS[scope],
        ),
      }),
    );
  }

  private sendHtml(res: Response, html: string, status = 200) {
    res
      .status(status)
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(html);
  }
}
