import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Provider, { Configuration, JWK, errors } from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';
import { randomBytes, randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { PrismaOidcAdapter } from '../adapters/prisma-oidc.adapter';
import {
  ALL_SCOPES,
  SCOPE_READ,
  SCOPE_WRITE,
  parseAccountId,
} from '../oauth.constants';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTHORIZATION_CODE_TTL_SECONDS = 10 * 60;
const INTERACTION_TTL_SECONDS = 60 * 60;
const GRANT_TTL_SECONDS = 180 * 24 * 60 * 60;
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;

/**
 * Owns the oidc-provider `Provider` instance: an OAuth 2.1-style
 * authorization server (PKCE required, DCR enabled, Resource Indicators /
 * RFC 8707 for MCP audience binding, JWT access tokens). Storage is a Prisma
 * adapter (see adapters/prisma-oidc.adapter.ts); interaction (login/consent)
 * pages are implemented separately in OAuthInteractionController/Service.
 *
 * Subject/accountId design: rather than bolt organisation binding onto
 * oidc-provider's Grant storage, the accountId itself is the composite
 * `${user_uuid}::${organisation_uuid}` (see oauth.constants.ts). This keeps
 * the adapter fully generic and makes `sub` naturally unique per
 * (user, organisation) pair, matching how ApiKey scoping already works in
 * this codebase. extraTokenClaims re-derives and re-verifies membership on
 * every token issuance so a removed member stops getting new access tokens
 * immediately (existing short-lived access tokens still expire within
 * ACCESS_TOKEN_TTL_SECONDS).
 */
@Injectable()
export class OidcProviderService implements OnModuleInit {
  private readonly logger = new Logger(OidcProviderService.name);
  private _provider?: Provider;
  private _publicJwks?: { keys: JWK[] };
  private _initError?: Error;
  readonly issuer: string;
  readonly mcpResourceUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiUrl = this.requireUrl('API_URL');
    this.issuer = (this.config.get<string>('OAUTH_ISSUER') || apiUrl).replace(
      /\/$/,
      '',
    );
    this.mcpResourceUrl = (
      this.config.get<string>('MCP_RESOURCE_URL') || `${apiUrl}/mcp`
    ).replace(/\/$/, '');
  }

  async onModuleInit() {
    try {
      await this.buildProvider();
    } catch (error) {
      // A misconfigured OAuth server (e.g. missing OAUTH_JWKS in production)
      // must not take the whole API down - onModuleInit errors are fatal to
      // Nest's bootstrap (see main.ts). Everything else in the app keeps
      // working; only OAuth/MCP routes degrade, via the provider/publicJwks
      // getters and callback() below throwing/responding 503 on demand.
      this._initError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `OAuth authorization server failed to start - /oauth and /mcp will return 503 until this is fixed: ${this._initError.message}`,
      );
    }
  }

  private async buildProvider() {
    const jwks = await this.loadJwks();
    this._publicJwks = { keys: jwks.keys.map(stripPrivateMaterial) };
    const cookieKeys = this.loadCookieKeys();
    const adapter = (name: string) => new PrismaOidcAdapter(name, this.prisma);

    const configuration: Configuration = {
      adapter,
      jwks,
      cookies: { keys: cookieKeys },
      scopes: [...ALL_SCOPES],
      claims: { openid: ['sub'] },
      clientDefaults: {
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        // MCP clients (Claude, ChatGPT) are public clients (no stable place to
        // keep a client_secret); PKCE (required below) is their protection.
        token_endpoint_auth_method: 'none',
      },
      pkce: {
        required: () => true,
      },
      features: {
        devInteractions: { enabled: false },
        // Open DCR: Claude/OpenAI self-register a client per deployment on
        // first connect, with no manual client provisioning on our side.
        registration: { enabled: true, initialAccessToken: false },
        registrationManagement: { enabled: true },
        // Claude's "Add custom connector" UI defaults to "Use Claude's
        // published identity" (OAuth Client ID Metadata Document, CIMD) over
        // DCR - client_id is an HTTPS URL Claude hosts, fetched instead of a
        // prior registration call. 'draft-02' is oidc-provider's required
        // acknowledgment for this still-experimental IETF draft.
        clientIdMetadataDocument: { enabled: true, ack: 'draft-02' },
        revocation: { enabled: true },
        userinfo: { enabled: true },
        // Optional (not required) - lets clients that support PAR use it.
        pushedAuthorizationRequests: {
          enabled: true,
          requirePushedAuthorizationRequests: false,
        },
        resourceIndicators: {
          enabled: true,
          getResourceServerInfo: async (_ctx, resourceIndicator) => {
            if (resourceIndicator !== this.mcpResourceUrl) {
              throw new errors.InvalidTarget(
                `Unknown resource indicator: ${resourceIndicator}`,
              );
            }
            return {
              scope: `${SCOPE_READ} ${SCOPE_WRITE}`,
              accessTokenFormat: 'jwt',
              accessTokenTTL: ACCESS_TOKEN_TTL_SECONDS,
              jwt: { sign: { alg: 'RS256' } },
            };
          },
          defaultResource: () => this.mcpResourceUrl,
        },
      },
      ttl: {
        AccessToken: ACCESS_TOKEN_TTL_SECONDS,
        AuthorizationCode: AUTHORIZATION_CODE_TTL_SECONDS,
        RefreshToken: REFRESH_TOKEN_TTL_SECONDS,
        Interaction: INTERACTION_TTL_SECONDS,
        Grant: GRANT_TTL_SECONDS,
        Session: SESSION_TTL_SECONDS,
      },
      interactions: {
        url: (_ctx, interaction) => `/oauth/interaction/${interaction.uid}`,
      },
      findAccount: async (_ctx, sub) => {
        const parsed = parseAccountId(sub);
        if (!parsed) return undefined;

        const user = await this.prisma.user.findUnique({
          where: { uuid: parsed.userUuid },
        });
        if (!user) return undefined;

        return {
          accountId: sub,
          claims: async () => ({
            sub,
            email: user.email,
            name: user.full_name ?? undefined,
          }),
        };
      },
      extraTokenClaims: async (_ctx, token) => {
        const accountId = 'accountId' in token ? token.accountId : undefined;
        const parsed = accountId ? parseAccountId(accountId) : undefined;
        if (!parsed) return undefined;

        const membership = await this.prisma.organisationMember.findUnique({
          where: {
            organisation_uuid_user_uuid: {
              organisation_uuid: parsed.organisationUuid,
              user_uuid: parsed.userUuid,
            },
          },
        });
        // Membership was revoked after the grant was created - deny new claims
        // rather than throw, so token issuance fails closed via the MCP guard
        // (which requires organisation_uuid/organisation_role to be present).
        if (!membership) return undefined;

        return {
          user_uuid: parsed.userUuid,
          organisation_uuid: parsed.organisationUuid,
          organisation_role: membership.role,
        };
      },
    };

    this._provider = new Provider(this.issuer, configuration);
    // Trust X-Forwarded-* from the platform's reverse proxy (Render/Vercel/etc.)
    // so issuer/redirect URLs resolve to https in staging/production.
    this._provider.proxy = true;
    this.attachErrorLogging(this._provider);
  }

  /**
   * oidc-provider does not log anything to the console by default - a
   * rejected DCR/CIMD/authorize request just becomes an HTTP error response,
   * invisible in platform logs unless something explicitly listens for it.
   * These are exactly the failures a client integration (Claude, ChatGPT)
   * surfaces as an opaque "couldn't connect" on their side.
   */
  private attachErrorLogging(provider: Provider) {
    provider.on('server_error', (ctx, err) => {
      this.logger.error(`server_error on ${ctx?.method} ${ctx?.path}: ${err.message}`, err.stack);
    });
    provider.on('authorization.error', (ctx, err) => {
      this.logger.warn(
        `authorization.error client_id=${ctx?.oidc?.params?.client_id} error=${err.error} detail=${err.error_description ?? err.message}`,
      );
    });
    provider.on('registration_create.error', (ctx, err) => {
      this.logger.warn(`registration_create.error: ${err.error} detail=${err.error_description ?? err.message}`);
    });
    provider.on('grant.error', (ctx, err) => {
      this.logger.warn(`grant.error: ${err.error} detail=${err.error_description ?? err.message}`);
    });
  }

  get provider(): Provider {
    if (!this._provider)
      throw new ServiceUnavailableException(this.unavailableMessage());
    return this._provider;
  }

  get publicJwks(): { keys: JWK[] } {
    if (!this._publicJwks)
      throw new ServiceUnavailableException(this.unavailableMessage());
    return this._publicJwks;
  }

  callback() {
    if (!this._provider) {
      const message = this.unavailableMessage();
      return (
        _req: unknown,
        res: {
          statusCode: number;
          setHeader: (k: string, v: string) => void;
          end: (b: string) => void;
        },
      ) => {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'oauth_unavailable', message }));
      };
    }

    const handler = this._provider.callback();
    // Unconditional per-request log line for the whole OAuth surface -
    // independent of oidc-provider's own event emitters (which never fire
    // for e.g. a request to a path no route recognizes), this is the one
    // thing guaranteed to show up in platform logs for every attempt.
    return (req: IncomingMessage, res: ServerResponse) => {
      const started = Date.now();
      const { method, url } = req;
      res.once('finish', () => {
        this.logger.log(`${method} ${url} -> ${res.statusCode} (${Date.now() - started}ms)`);
      });
      return handler(req, res);
    };
  }

  private unavailableMessage(): string {
    return this._initError
      ? `OAuth authorization server is not configured: ${this._initError.message}`
      : 'OAuth authorization server is still starting up';
  }

  private requireUrl(key: string): string {
    const value = this.config.get<string>(key);
    if (!value)
      throw new Error(
        `${key} must be set to configure the OAuth authorization server`,
      );
    return value;
  }

  private async loadJwks(): Promise<{ keys: JWK[] }> {
    const raw = this.config.get<string>('OAUTH_JWKS');
    if (raw) return JSON.parse(raw);

    this.assertEphemeralAllowed('OAUTH_JWKS');
    this.logger.warn(
      'OAUTH_JWKS not set - generating an ephemeral signing key for this process only.',
    );
    const rsa = await generateKeyPair('RS256', {
      modulusLength: 2048,
      extractable: true,
    });
    const jwk = await exportJWK(rsa.privateKey);
    return { keys: [{ ...jwk, kid: randomUUID(), use: 'sig', alg: 'RS256' }] };
  }

  private loadCookieKeys(): string[] {
    const raw = this.config.get<string>('OAUTH_COOKIE_KEYS');
    if (raw) {
      return raw
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
    }

    this.assertEphemeralAllowed('OAUTH_COOKIE_KEYS');
    this.logger.warn(
      'OAUTH_COOKIE_KEYS not set - generating an ephemeral cookie secret for this process only.',
    );
    return [randomBytes(32).toString('base64url')];
  }

  private assertEphemeralAllowed(key: string) {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    if (nodeEnv === 'staging' || nodeEnv === 'production') {
      throw new Error(
        `${key} must be set in ${nodeEnv} (generate with scripts/generate-oauth-keys.ts) - ` +
          'an ephemeral value would invalidate every issued token on every restart.',
      );
    }
  }
}

// Allowlist rather than a denylist of private fields to strip: for a
// function whose whole job is producing the PUBLIC jwks, failing safe means
// dropping any field we don't explicitly recognize as public, not keeping it.
const PUBLIC_JWK_FIELDS = [
  'kty',
  'crv',
  'x',
  'y',
  'n',
  'e',
  'kid',
  'use',
  'alg',
  'key_ops',
  'x5c',
] as const;

function stripPrivateMaterial(jwk: JWK): JWK {
  const publicJwk: JWK = {};
  for (const field of PUBLIC_JWK_FIELDS) {
    if (jwk[field] !== undefined)
      (publicJwk as Record<string, unknown>)[field] = jwk[field];
  }
  return publicJwk;
}
