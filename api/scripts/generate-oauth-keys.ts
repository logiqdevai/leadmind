/**
 * Generates the secrets needed for the OAuth authorization server:
 *  - OAUTH_COOKIE_KEYS: rotating secrets for signing oidc-provider's cookies
 *  - OAUTH_JWKS: a private JWKS used to sign access/ID tokens (RS256 + EC P-256 for ES256)
 *
 * Does not touch the database or any running environment - just prints values
 * to paste into .env.<environment>. Run from the api/ directory with:
 *   npx ts-node -r tsconfig-paths/register scripts/generate-oauth-keys.ts
 */
import { generateKeyPair, exportJWK } from 'jose';
import { randomBytes, randomUUID } from 'crypto';

async function main() {
    const cookieKeys = [randomBytes(32).toString('base64url'), randomBytes(32).toString('base64url')];

    const rsa = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
    const ec = await generateKeyPair('ES256', { extractable: true });

    const rsaJwk = await exportJWK(rsa.privateKey);
    const ecJwk = await exportJWK(ec.privateKey);

    const jwks = {
        keys: [
            { ...rsaJwk, kid: randomUUID(), use: 'sig', alg: 'RS256' },
            { ...ecJwk, kid: randomUUID(), use: 'sig', alg: 'ES256' },
        ],
    };

    console.log('OAUTH_COOKIE_KEYS=%s', cookieKeys.join(','));
    console.log('OAUTH_JWKS=%s', JSON.stringify(jwks));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
