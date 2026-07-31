import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "h1",
    "h2",
    "h3",
];

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "width", "height", "style"];

const FORBID_TAGS = ["script", "iframe", "style", "html", "body", "head", "meta"];

const FORBID_ATTR = ["class", "id"];

const ESCAPED_IMG_PATTERN = /&lt;\s*img\b([\s\S]*?)\s*\/?\s*&gt;/gi;

export const EMAIL_FOOTER_LOGO_WIDTH = 96;

export const EMAIL_FOOTER_LOGO_STYLE =
    "max-width:96px;width:96px;height:auto;display:inline-block;border:0;outline:none";

export const EMAIL_FOOTER_LOGO_IMG_HTML = `<img src="{{logo_url}}" alt="Logo" width="${EMAIL_FOOTER_LOGO_WIDTH}" style="${EMAIL_FOOTER_LOGO_STYLE}" />`;

function decodeBasicEntities(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#0*34;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#0*39;/g, "'")
        .replace(/&amp;/g, "&");
}

export function normalizeEscapedEmailImages(input: string): string {
    if (!input || !input.includes("&lt;")) return input;
    return input.replace(ESCAPED_IMG_PATTERN, (_match, rawAttrs: string) => {
        const attrs = decodeBasicEntities(rawAttrs).trim().replace(/\/\s*$/, "").trim();
        return attrs ? `<img ${attrs}>` : "<img>";
    });
}

function attrValue(attrs: string, name: string): string {
    const match = new RegExp(
        `(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
        "i",
    ).exec(attrs);
    return match?.[2] ?? match?.[3] ?? match?.[4] ?? "";
}

export function constrainEmailLogoImages(html: string): string {
    if (!html || !html.includes("<img")) return html;
    return html.replace(/<img\b([^>]*?)\/?>/gi, (_full, rawAttrs: string) => {
        const src = attrValue(rawAttrs, "src");
        if (!src) return "";
        const alt = attrValue(rawAttrs, "alt") || "Logo";
        return `<img src="${src}" alt="${alt}" width="${EMAIL_FOOTER_LOGO_WIDTH}" style="${EMAIL_FOOTER_LOGO_STYLE}">`;
    });
}

export function sanitizeEmailHtml(input: string): string {
    if (!input) return "";
    const cleaned = DOMPurify.sanitize(normalizeEscapedEmailImages(input), {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        FORBID_TAGS,
        FORBID_ATTR,
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\{\{[a-zA-Z0-9_]+\}\}$)/i,
        ADD_ATTR: ["target", "rel"],
    });
    return constrainEmailLogoImages(cleaned);
}

export function isEmailHtmlEmpty(html: string): boolean {
    const stripped = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return stripped.replace(/\s|&nbsp;/g, "").length === 0;
}
