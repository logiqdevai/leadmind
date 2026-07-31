import {
    applySmtpEmailTracking,
    createEmailTrackingToken,
    parseEmailTrackingToken,
    rewriteEmailLinksForClickTracking,
} from './email-tracking.util';

describe('email-tracking.util', () => {
    const secret = 'test-secret';
    const apiBase = 'https://api.example.com';
    const messageUuid = '11111111-1111-1111-1111-111111111111';

    it('round-trips open tokens', () => {
        const token = createEmailTrackingToken({ v: 1, t: 'o', m: messageUuid }, secret);
        expect(parseEmailTrackingToken(token, secret)).toEqual({
            v: 1,
            t: 'o',
            m: messageUuid,
        });
    });

    it('rejects tampered tokens', () => {
        const token = createEmailTrackingToken({ v: 1, t: 'o', m: messageUuid }, secret);
        expect(parseEmailTrackingToken(`${token}x`, secret)).toBeNull();
        expect(parseEmailTrackingToken(token, 'other-secret')).toBeNull();
    });

    it('rewrites http links and skips mailto/unsubscribe', () => {
        const html = [
            '<p><a href="https://example.com/x">Go</a></p>',
            '<p><a href="mailto:a@b.com">Mail</a></p>',
            '<p><a href="https://app.example.com/unsubscribe/abc">Unsub</a></p>',
        ].join('');
        const out = rewriteEmailLinksForClickTracking(html, apiBase, messageUuid, secret);
        expect(out).toContain(`${apiBase}/t/c/`);
        expect(out).toContain('mailto:a@b.com');
        expect(out).toContain('/unsubscribe/abc');
        expect(out.match(/href="https:\/\/example\.com\/x"/)).toBeNull();
    });

    it('injects open pixel for smtp tracking', () => {
        const html = '<p>Hello <a href="https://example.com">x</a></p>';
        const out = applySmtpEmailTracking({
            html,
            messageUuid,
            apiBase,
            secret,
        });
        expect(out).toContain(`${apiBase}/t/o/`);
        expect(out).toContain('.gif');
        expect(out).toContain(`${apiBase}/t/c/`);
    });
});
