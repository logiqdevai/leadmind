import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OAuthConnectionStatus, OrganisationRole } from '@/generated/prisma';
import { CreateAccessTokenDto } from '../dto/create-access-token.dto';
import { OidcProviderService } from './oidc-provider.service';

interface RecordGrantInput {
  organisationUuid: string;
  grantedByUserUuid: string;
  oauthClientId: string;
  grantId: string;
  clientName?: string | null;
  clientUri?: string | null;
  scope: string;
}

const CONNECTION_SELECT = {
  uuid: true,
  organisation_uuid: true,
  oauth_client_id: true,
  client_name: true,
  client_uri: true,
  scope: true,
  status: true,
  last_used_at: true,
  revoked_at: true,
  created_at: true,
  updated_at: true,
  granted_by: { select: { uuid: true, email: true, full_name: true } },
};

/**
 * Org-facing "Connected apps" bookkeeping (Settings UI equivalent of the
 * API Keys page). Kept separate from oidc-provider's own adapter storage so
 * revoking access doesn't require understanding oidc-provider's internal
 * model shapes.
 */
@Injectable()
export class OAuthConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oidc: OidcProviderService,
  ) {}

  async recordGrant(input: RecordGrantInput) {
    await this.prisma.oAuthConnection.upsert({
      where: { grant_id: input.grantId },
      create: {
        organisation_uuid: input.organisationUuid,
        granted_by_user_uuid: input.grantedByUserUuid,
        oauth_client_id: input.oauthClientId,
        grant_id: input.grantId,
        client_name: input.clientName ?? null,
        client_uri: input.clientUri ?? null,
        scope: input.scope,
        status: OAuthConnectionStatus.ACTIVE,
      },
      update: {
        client_name: input.clientName ?? null,
        client_uri: input.clientUri ?? null,
        scope: input.scope,
        status: OAuthConnectionStatus.ACTIVE,
        revoked_at: null,
      },
    });
  }

  async findAll(organisationUuid: string) {
    return this.prisma.oAuthConnection.findMany({
      where: { organisation_uuid: organisationUuid },
      select: CONNECTION_SELECT,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Mints a personal access token for the caller in this organisation, for
   * clients that can't run the browser OAuth flow. The role is re-read from
   * the membership table rather than trusted from the JWT, so a demoted admin
   * can't mint a new token with stale claims.
   */
  async createAccessToken(
    userUuid: string,
    organisationUuid: string,
    dto: CreateAccessTokenDto,
  ) {
    const membership = await this.prisma.organisationMember.findUnique({
      where: {
        organisation_uuid_user_uuid: {
          organisation_uuid: organisationUuid,
          user_uuid: userUuid,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organisation');
    }
    if (
      membership.role !== OrganisationRole.OWNER &&
      membership.role !== OrganisationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only owners and admins can create access tokens',
      );
    }

    const { token, expiresAt } = await this.oidc.signPersonalAccessToken({
      userUuid,
      organisationUuid,
      organisationRole: membership.role,
      scopes: dto.scopes,
      expiresIn: dto.expires_in,
    });

    return {
      token,
      scope: dto.scopes.join(' '),
      organisation_uuid: organisationUuid,
      expires_at: expiresAt?.toISOString() ?? null,
    };
  }

  async revoke(organisationUuid: string, uuid: string) {
    const connection = await this.prisma.oAuthConnection.findFirst({
      where: { uuid, organisation_uuid: organisationUuid },
    });
    if (!connection) throw new NotFoundException('Connected app not found');

    // Destroys every AccessToken/RefreshToken/AuthorizationCode issued under
    // this Grant (see PrismaOidcAdapter.revokeByGrantId).
    await this.oidc.provider.Grant.adapter.revokeByGrantId(connection.grant_id);

    return this.prisma.oAuthConnection.update({
      where: { uuid },
      data: { status: OAuthConnectionStatus.REVOKED, revoked_at: new Date() },
      select: CONNECTION_SELECT,
    });
  }
}
