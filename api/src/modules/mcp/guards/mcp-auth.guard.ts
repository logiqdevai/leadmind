import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createLocalJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OidcProviderService } from '@/modules/oauth/services/oidc-provider.service';

export interface McpAuth {
  userUuid: string;
  organisationUuid: string;
  organisationRole: string;
  scopes: string[];
  oauthClientId?: string;
}

/**
 * Authenticates MCP requests against our own OAuth authorization server.
 * Access tokens are JWTs signed by OidcProviderService, so verification is a
 * local signature check (createLocalJWKSet) against the same public keys -
 * no network round trip, no DB lookup for the common case.
 *
 * Two extra checks the JWT signature alone can't give us:
 *  - `aud` must be this exact MCP resource (RFC 8707 audience binding -
 *    without this, a token minted for a *different* resource server that
 *    happens to trust the same AS could be replayed here).
 *  - the (user, organisation) membership implied by `sub` must still exist,
 *    so removing someone from an organisation takes effect immediately
 *    instead of waiting out the access token's TTL.
 */
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(
    private readonly oidc: OidcProviderService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const resourceMetadataUrl = `${this.oidc.issuer}/.well-known/oauth-protected-resource/mcp`;

    const fail = (description: string): never => {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer error="invalid_token", error_description="${description}", resource_metadata="${resourceMetadataUrl}"`,
      );
      throw new UnauthorizedException(description);
    };

    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) return fail('Missing bearer token');

    // Not inside the try/catch below: a misconfigured OAuth server
    // (ServiceUnavailableException) must surface as 503, not get swallowed
    // into a misleading "invalid token" 401.
    const jwks = createLocalJWKSet(this.oidc.publicJwks as any);

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(authHeader.slice(7), jwks, {
        issuer: this.oidc.issuer,
        audience: this.oidc.mcpResourceUrl,
      });
      payload = result.payload;
    } catch {
      return fail('Invalid or expired access token');
    }

    const organisationUuid = payload.organisation_uuid as string | undefined;
    const userUuid = (payload.user_uuid as string | undefined) ?? undefined;
    let organisationRole = payload.organisation_role as string | undefined;

    if (!organisationUuid || !userUuid)
      return fail('Access token is missing organisation context');

    const membership = await this.prisma.organisationMember.findUnique({
      where: {
        organisation_uuid_user_uuid: {
          organisation_uuid: organisationUuid,
          user_uuid: userUuid,
        },
      },
    });
    if (!membership)
      return fail('You are no longer a member of this organisation');
    organisationRole = membership.role;

    const scopes = String(payload.scope ?? '')
      .split(' ')
      .filter(Boolean);

    const auth: McpAuth = {
      userUuid,
      organisationUuid,
      organisationRole,
      scopes,
      oauthClientId: payload.client_id as string | undefined,
    };
    req.mcpAuth = auth;
    return true;
  }
}
