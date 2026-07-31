import sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'u',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'h1',
    'h2',
    'h3',
];

const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

const ESCAPED_IMG_PATTERN = /&lt;\s*img\b([\s\S]*?)\s*\/?\s*&gt;/gi;

export const EMAIL_FOOTER_LOGO_WIDTH = 96;

export const EMAIL_FOOTER_LOGO_STYLE =
    'max-width:96px;width:96px;height:auto;display:inline-block;border:0;outline:none';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
        a: ['href'],
        img: ['src', 'alt', 'width', 'height', 'style'],
    },
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    allowedStyles: {
        img: {
            'max-width': [/^\d+px$/],
            width: [/^\d+px$/],
            height: [/^auto$/],
            display: [/^inline-block$/, /^block$/],
            border: [/^0$/, /^none$/],
            outline: [/^none$/],
        },
    },
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', {
            target: '_blank',
            rel: 'noopener noreferrer',
        }),
        img: (_tagName, attribs) => ({
            tagName: 'img',
            attribs: {
                src: attribs.src ?? '',
                alt: attribs.alt || 'Logo',
                width: String(EMAIL_FOOTER_LOGO_WIDTH),
                style: EMAIL_FOOTER_LOGO_STYLE,
            },
        }),
    },
};

function decodeBasicEntities(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#0*34;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#0*39;/g, "'")
        .replace(/&amp;/g, '&');
}

export function normalizeEscapedEmailImages(input: string): string {
    if (!input || !input.includes('&lt;')) return input;
    return input.replace(ESCAPED_IMG_PATTERN, (_match, rawAttrs: string) => {
        const attrs = decodeBasicEntities(rawAttrs).trim().replace(/\/\s*$/, '').trim();
        return attrs ? `<img ${attrs}>` : '<img>';
    });
}

export function sanitizeEmailHtml(input: string): string {
    if (!input) return '';
    return sanitizeHtml(normalizeEscapedEmailImages(input), SANITIZE_OPTIONS);
}

export function isEmailHtmlEmpty(html: string): boolean {
    const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
    return stripped.replace(/\s|&nbsp;/g, '').length === 0;
}
