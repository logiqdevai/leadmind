import { randomBytes, createHash } from 'crypto';

const KEY_PREFIX = 'lm_live_';

export interface GeneratedApiKey {
    token: string;
    key_prefix: string;
    last4: string;
    key_hash: string;
}

export function generateApiKey(): GeneratedApiKey {
    const random = randomBytes(32).toString('base64url');
    const token = `${KEY_PREFIX}${random}`;
    return {
        token,
        key_prefix: token.slice(0, KEY_PREFIX.length + 8),
        last4: token.slice(-4),
        key_hash: hashApiKey(token),
    };
}

export function hashApiKey(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}
