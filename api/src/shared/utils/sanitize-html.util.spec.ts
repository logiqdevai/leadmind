import {
    EMAIL_FOOTER_LOGO_STYLE,
    EMAIL_FOOTER_LOGO_WIDTH,
    normalizeEscapedEmailImages,
    sanitizeEmailHtml,
} from './sanitize-html.util';

describe('sanitizeEmailHtml escaped images', () => {
    it('converts escaped logo img tags into real footer-sized img elements', () => {
        const input =
            '<p>&lt;img src="{{logo_url}}" alt="Logo" width="120" /&gt;</p>';
        expect(normalizeEscapedEmailImages(input)).toBe(
            '<p><img src="{{logo_url}}" alt="Logo" width="120"></p>',
        );
        const out = sanitizeEmailHtml(input);
        expect(out).toContain('<img');
        expect(out).toContain('src="{{logo_url}}"');
        expect(out).toContain(`width="${EMAIL_FOOTER_LOGO_WIDTH}"`);
        expect(out).toContain(EMAIL_FOOTER_LOGO_STYLE);
        expect(out).not.toContain('&lt;img');
    });

    it('forces footer size even when img has no width', () => {
        const input =
            '<p><img src="https://cdn.example.com/logo.png" alt="Logo"></p>';
        const out = sanitizeEmailHtml(input);
        expect(out).toContain(`width="${EMAIL_FOOTER_LOGO_WIDTH}"`);
        expect(out).toContain('max-width:96px');
        expect(out).toContain('src="https://cdn.example.com/logo.png"');
    });
});
