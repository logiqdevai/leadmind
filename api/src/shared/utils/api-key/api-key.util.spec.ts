/// <reference types="jest" />
import { generateApiKey, hashApiKey } from './api-key.util';

describe('api-key.util', () => {
    describe('generateApiKey', () => {
        it('produces a token with the expected prefix', () => {
            const key = generateApiKey();
            expect(key.token.startsWith('lm_live_')).toBe(true);
        });

        it('derives key_hash as the sha256 of the token', () => {
            const key = generateApiKey();
            expect(key.key_hash).toBe(hashApiKey(key.token));
        });

        it('derives last4 from the end of the token', () => {
            const key = generateApiKey();
            expect(key.last4).toBe(key.token.slice(-4));
            expect(key.last4).toHaveLength(4);
        });

        it('derives key_prefix as a leading fragment of the token', () => {
            const key = generateApiKey();
            expect(key.token.startsWith(key.key_prefix)).toBe(true);
        });

        it('never returns the same token twice', () => {
            const a = generateApiKey();
            const b = generateApiKey();
            expect(a.token).not.toBe(b.token);
            expect(a.key_hash).not.toBe(b.key_hash);
        });
    });

    describe('hashApiKey', () => {
        it('is deterministic', () => {
            const token = 'lm_live_fixed-example-token';
            expect(hashApiKey(token)).toBe(hashApiKey(token));
        });

        it('produces a 64-char hex digest', () => {
            const hash = hashApiKey('lm_live_fixed-example-token');
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });
});
