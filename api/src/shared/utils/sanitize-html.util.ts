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
    'table',
    'tbody',
    'tr',
    'td',
    'span',
];

const TEXT_STYLES: Record<string, RegExp[]> = {
    color: [/^#[0-9a-fA-F]{3,8}$/],
    'font-size': [/^\d{1,2}px$/],
    'font-weight': [/^[1-9]00$/, /^bold$/, /^normal$/],
    'font-family': [/^[\w\s,'"-]+$/],
    'line-height': [/^\d{1,2}px$/],
    'letter-spacing': [/^-?[\d.]+(px|em)$/],
    'text-decoration': [/^none$/],
    'text-transform': [/^uppercase$/],
    'white-space': [/^nowrap$/],
};

const CELL_STYLES: Record<string, RegExp[]> = {
    ...TEXT_STYLES,
    padding: [/^(\d{1,2}px ?){1,4}$/],
    margin: [/^(\d{1,2}px ?){1,4}$/],
    width: [/^\d{1,3}px$/],
    'vertical-align': [/^(top|middle|bottom)$/],
    'text-align': [/^(left|center|right)$/],
    'background-color': [/^#[0-9a-fA-F]{3,8}$/],
    'border-collapse': [/^collapse$/],
    'border-left': [/^\d{1,2}px solid #[0-9a-fA-F]{3,8}$/],
};

const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

const ESCAPED_IMG_PATTERN = /&lt;\s*img\b([\s\S]*?)\s*\/?\s*&gt;/gi;

export const EMAIL_FOOTER_LOGO_WIDTH = 96;

export const EMAIL_FOOTER_LOGO_STYLE =
    'max-width:96px;width:96px;height:auto;display:inline-block;border:0;outline:none';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
        a: ['href', 'style'],
        img: ['src', 'alt', 'width', 'height', 'style'],
        table: ['cellpadding', 'cellspacing', 'border', 'style'],
        td: ['valign', 'width', 'style'],
        span: ['style'],
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
        a: TEXT_STYLES,
        span: TEXT_STYLES,
        table: CELL_STYLES,
        td: CELL_STYLES,
    },
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', {
            target: '_blank',
            rel: 'noopener noreferrer',
        }),
        img: (_tagName, attribs) => {
            const requested = Number.parseInt(attribs.width ?? '', 10);
            const width =
                requested > 0 && requested < EMAIL_FOOTER_LOGO_WIDTH
                    ? requested
                    : EMAIL_FOOTER_LOGO_WIDTH;
            return {
                tagName: 'img',
                attribs: {
                    src: attribs.src ?? '',
                    alt: attribs.alt || 'Logo',
                    width: String(width),
                    style: EMAIL_FOOTER_LOGO_STYLE.replace(/96px/g, `${width}px`),
                },
            };
        },
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
