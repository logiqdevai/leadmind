import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type Provider from 'oidc-provider';
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

type InteractionDetails = Awaited<ReturnType<Provider['interactionDetails']>>;

export interface InteractionDetailsResponse {
  uid: string;
  prompt: 'login' | 'consent';
  client?: { name: string; uri?: string };
  organisationName?: string;
  scopeDescriptions?: string[];
}

export interface InteractionResultResponse {
  redirect_to: string;
}

/**
 * Backs the frontend's `/oauth/authorize/:uid` page (see
 * OidcProviderService's `interactions.url`) with a plain JSON API instead of
 * server-rendered HTML - the frontend already has the design system and,
 * more importantly, the user's existing session (its own JWT via
 * JwtGuard/CurrentUser), so a logged-in user never has to re-enter
 * credentials just to approve an MCP connection.
 */
@Injectable()
export class OAuthInteractionService {
  constructor(
    private readonly oidc: OidcProviderService,
    private readonly prisma: PrismaService,
    private readonly connections: OAuthConnectionsService,
  ) {}

  async getDetails(
    req: Request,
    res: Response,
    uid: string,
  ): Promise<InteractionDetailsResponse> {
    const interaction = await this.loadInteraction(req, res, uid);

    if (interaction.prompt.name === 'login') {
      return { uid, prompt: 'login' };
    }

    if (interaction.prompt.name === 'consent') {
      return {
        uid,
        prompt: 'consent',
        ...(await this.describeConsent(interaction)),
      };
    }

    throw new BadRequestException(
      `Unsupported interaction step: ${interaction.prompt.name}`,
    );
  }

  async login(
    req: Request,
    res: Response,
    uid: string,
    dto: InteractionLoginDto,
    userUuid: string,
  ): Promise<InteractionResultResponse> {
    await this.loadInteraction(req, res, uid);

    const membership = await this.prisma.organisationMember.findUnique({
      where: {
        organisation_uuid_user_uuid: {
          organisation_uuid: dto.organisation_uuid,
          user_uuid: userUuid,
        },
      },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of that workspace.');

    const accountId = buildAccountId(userUuid, dto.organisation_uuid);
    const redirect_to = await this.oidc.provider.interactionResult(
      req,
      res,
      { login: { accountId } },
      { mergeWithLastSubmission: false },
    );
    return { redirect_to };
  }

  async confirm(
    req: Request,
    res: Response,
    uid: string,
  ): Promise<InteractionResultResponse> {
    const interaction = await this.loadInteraction(req, res, uid);
    const { session, params, grantId, prompt } = interaction;

    if (!session?.accountId)
      throw new BadRequestException(
        'Your session expired. Please start again.',
      );

    const grant = grantId
      ? await this.oidc.provider.Grant.find(grantId)
      : new this.oidc.provider.Grant({
          accountId: session.accountId,
          clientId: params.client_id as string,
        });
    if (!grant)
      throw new BadRequestException(
        'Your session expired. Please start again.',
      );

    const missingOIDCScope = prompt.details.missingOIDCScope as
      | string[]
      | undefined;
    if (missingOIDCScope?.length)
      grant.addOIDCScope(missingOIDCScope.join(' '));

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

    const redirect_to = await this.oidc.provider.interactionResult(
      req,
      res,
      { consent: grantId ? {} : { grantId: newGrantId } },
      { mergeWithLastSubmission: true },
    );
    return { redirect_to };
  }

  async abort(
    req: Request,
    res: Response,
    uid: string,
  ): Promise<InteractionResultResponse> {
    await this.loadInteraction(req, res, uid);
    const redirect_to = await this.oidc.provider.interactionResult(
      req,
      res,
      {
        error: 'access_denied',
        error_description:
          'End-User denied access to the requesting application',
      },
      { mergeWithLastSubmission: false },
    );
    return { redirect_to };
  }

  private async loadInteraction(
    req: Request,
    res: Response,
    uid: string,
  ): Promise<InteractionDetails> {
    const interaction = await this.oidc.provider.interactionDetails(req, res);
    if (interaction.uid !== uid) {
      throw new NotFoundException('Interaction not found or expired');
    }
    return interaction;
  }

  private async describeConsent(interaction: InteractionDetails) {
    const { params, session } = interaction;

    // The organisation bound to this authorization is whichever one was
    // chosen at the login step (session.accountId), which is not
    // necessarily the org the frontend currently has active - a user can
    // pick a different workspace to authorize than the one they're
    // browsing the app in.
    const parsedAccount = session?.accountId
      ? parseAccountId(session.accountId)
      : undefined;

    const [client, organisation] = await Promise.all([
      this.oidc.provider.Client.find(params.client_id as string),
      parsedAccount
        ? this.prisma.organisation.findUnique({
            where: { uuid: parsedAccount.organisationUuid },
          })
        : Promise.resolve(null),
    ]);

    const requestedScopes = String(params.scope ?? '')
      .split(' ')
      .filter((scope): scope is OAuthScope =>
        (ALL_SCOPES as readonly string[]).includes(scope),
      );

    return {
      client: {
        name: client?.clientName || client?.clientId || 'This application',
        uri: client?.clientUri,
      },
      organisationName: organisation?.name,
      scopeDescriptions: requestedScopes.map(
        (scope) => SCOPE_DESCRIPTIONS[scope],
      ),
    };
  }
}
