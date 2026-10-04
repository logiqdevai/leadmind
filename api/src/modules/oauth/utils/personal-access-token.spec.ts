import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  type JWK,
} from 'jose';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  PERSONAL_ACCESS_TOKEN_CLIENT_ID,
  signPersonalAccessToken,
} from './personal-access-token';

const ISSUER = 'https://api.example.test';
const AUDIENCE = 'https://api.example.test/mcp';
const USER_UUID = '3bf4d006-4722-476a-a7f6-d83e03ad9933';
const ORG_UUID = '9b0b6b8c-193e-4b98-8eb5-288aa275fc74';
const NOW_MS = Date.UTC(2026, 9, 4, 12, 0, 0);

describe('signPersonalAccessToken', () => {
  let privateJwk: JWK;
  let publicJwks: { keys: JWK[] };

  beforeAll(async () => {
    const { privateKey } = await generateKeyPair('RS256', {
      extractable: true,
    });
    const jwk = await exportJWK(privateKey);
    const kid = 'test-kid';
    privateJwk = { ...jwk, kid, use: 'sig', alg: 'RS256' };
    // Public half only, as the guard sees it: strip every private RSA field.
    const publicKey: Record<string, unknown> = { ...privateJwk };
    for (const field of ['d', 'p', 'q', 'dp', 'dq', 'qi'])
      delete publicKey[field];
    publicJwks = { keys: [publicKey as JWK] };
  });

  const sign = (
    expiresIn: Parameters<typeof signPersonalAccessToken>[0]['expiresIn'],
    scopes = ['mcp:read', 'mcp:write'],
  ) =>
    signPersonalAccessToken({
      issuer: ISSUER,
      audience: AUDIENCE,
      privateJwk,
      userUuid: USER_UUID,
      organisationUuid: ORG_UUID,
      organisationRole: 'OWNER',
      scopes,
      expiresIn,
      now: NOW_MS,
    });

  it('verifies against the same JWKS, issuer and audience McpAuthGuard uses', async () => {
    const { token } = await sign('30d');

    const { payload, protectedHeader } = await jwtVerify(
      token,
      createLocalJWKSet(publicJwks),
      {
        issuer: ISSUER,
        audience: AUDIENCE,
      },
    );

    expect(protectedHeader.alg).toBe('RS256');
    expect(protectedHeader.kid).toBe('test-kid');
    expect(payload.sub).toBe(`${USER_UUID}::${ORG_UUID}`);
    expect(payload.user_uuid).toBe(USER_UUID);
    expect(payload.organisation_uuid).toBe(ORG_UUID);
    expect(payload.organisation_role).toBe('OWNER');
    expect(payload.scope).toBe('mcp:read mcp:write');
    expect(payload.client_id).toBe(PERSONAL_ACCESS_TOKEN_CLIENT_ID);
    expect(payload.jti).toBeTruthy();
  });

  it('rejects a token presented for a different resource (audience binding)', async () => {
    const { token } = await sign('30d');

    await expect(
      jwtVerify(token, createLocalJWKSet(publicJwks), {
        issuer: ISSUER,
        audience: 'https://api.example.test/other',
      }),
    ).rejects.toThrow();
  });

  it.each([
    ['7d', ACCESS_TOKEN_LIFETIME_SECONDS['7d']],
    ['30d', ACCESS_TOKEN_LIFETIME_SECONDS['30d']],
    ['90d', ACCESS_TOKEN_LIFETIME_SECONDS['90d']],
    ['1y', ACCESS_TOKEN_LIFETIME_SECONDS['1y']],
  ] as const)('sets exp %s seconds after iat', async (expiresIn, seconds) => {
    const { token, expiresAt } = await sign(expiresIn);
    const { payload } = await jwtVerify(token, createLocalJWKSet(publicJwks), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(payload.exp! - payload.iat!).toBe(seconds);
    expect(expiresAt?.getTime()).toBe(NOW_MS + seconds * 1000);
  });

  it('omits exp entirely for "never" and reports no expiry date', async () => {
    const { token, expiresAt } = await sign('never');
    const { payload } = await jwtVerify(token, createLocalJWKSet(publicJwks), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(payload.exp).toBeUndefined();
    expect(expiresAt).toBeNull();
  });

  it('keeps the requested scope list exactly (read-only token has no write)', async () => {
    const { token } = await sign('90d', ['mcp:read']);
    const { payload } = await jwtVerify(token, createLocalJWKSet(publicJwks), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(payload.scope).toBe('mcp:read');
  });

  it('refuses a signing key without a kid', async () => {
    await expect(
      signPersonalAccessToken({
        issuer: ISSUER,
        audience: AUDIENCE,
        privateJwk: { ...privateJwk, kid: undefined },
        userUuid: USER_UUID,
        organisationUuid: ORG_UUID,
        organisationRole: 'OWNER',
        scopes: ['mcp:read'],
        expiresIn: '30d',
      }),
    ).rejects.toThrow('Signing key has no kid');
  });
});
