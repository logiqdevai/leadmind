import { randomUUID } from 'crypto';
import { importJWK, SignJWT, type JWK } from 'jose';
import { buildAccountId } from '../oauth.constants';

/** `client_id` stamped on tokens created from Settings, so MCP audit logs can tell them apart from OAuth-issued tokens. */
export const PERSONAL_ACCESS_TOKEN_CLIENT_ID = 'personal-access-token';

/** Token lifetime in seconds. `null` means the token has no `exp` claim. */
export const ACCESS_TOKEN_LIFETIME_SECONDS = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
  '1y': 365 * 24 * 60 * 60,
  never: null,
} as const;

export type AccessTokenExpiry = keyof typeof ACCESS_TOKEN_LIFETIME_SECONDS;

export const ACCESS_TOKEN_EXPIRY_OPTIONS = Object.keys(
  ACCESS_TOKEN_LIFETIME_SECONDS,
) as AccessTokenExpiry[];

export interface PersonalAccessTokenInput {
  issuer: string;
  audience: string;
  /** RSA private JWK (with `d`) from OAUTH_JWKS - the same key the provider signs with. */
  privateJwk: JWK;
  userUuid: string;
  organisationUuid: string;
  organisationRole: string;
  scopes: string[];
  expiresIn: AccessTokenExpiry;
  /** Epoch milliseconds; defaults to now. Exposed for tests. */
  now?: number;
}

/**
 * Signs an access token with the same key, header, and claims the OAuth
 * provider issues, so McpAuthGuard verifies it unchanged. Used for
 * "create a token" in Settings, where the user wants a standing credential
 * for a client that can't run the browser OAuth flow.
 */
export async function signPersonalAccessToken(
  input: PersonalAccessTokenInput,
): Promise<{ token: string; expiresAt: Date | null }> {
  if (!input.privateJwk.kid) {
    throw new Error('Signing key has no kid');
  }

  const key = await importJWK(input.privateJwk, 'RS256');
  const iat = Math.floor((input.now ?? Date.now()) / 1000);
  const lifetime = ACCESS_TOKEN_LIFETIME_SECONDS[input.expiresIn];

  const signer = new SignJWT({
    client_id: PERSONAL_ACCESS_TOKEN_CLIENT_ID,
    scope: input.scopes.join(' '),
    user_uuid: input.userUuid,
    organisation_uuid: input.organisationUuid,
    organisation_role: input.organisationRole,
  })
    .setProtectedHeader({
      alg: 'RS256',
      kid: input.privateJwk.kid,
      typ: 'at+jwt',
    })
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setSubject(buildAccountId(input.userUuid, input.organisationUuid))
    .setJti(randomUUID())
    .setIssuedAt(iat);

  if (lifetime !== null) signer.setExpirationTime(iat + lifetime);

  const token = await signer.sign(key);
  return {
    token,
    expiresAt: lifetime === null ? null : new Date((iat + lifetime) * 1000),
  };
}
