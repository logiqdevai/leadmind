import * as crypto from 'crypto';

export type EmailOpenTrackingPayload = { v: 1; t: 'o'; m: string };
export type EmailClickTrackingPayload = { v: 1; t: 'c'; m: string; u: string };
export type EmailTrackingPayload = EmailOpenTrackingPayload | EmailClickTrackingPayload;

const SIG_LEN = 22;

const TRANSPARENT_GIF_BASE64 =
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const TRANSPARENT_GIF = Buffer.from(TRANSPARENT_GIF_BASE64, 'base64');

function signBody(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('base64url').slice(0, SIG_LEN);
}

function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function createEmailTrackingToken(
    payload: EmailTrackingPayload,
    secret: string,
): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${signBody(body, secret)}`;
}

export function parseEmailTrackingToken(
    token: string,
    secret: string,
): EmailTrackingPayload | null {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!body || !sig || !safeEqual(sig, signBody(body, secret))) {
        return null;
    }
    try {
        const parsed = JSON.parse(
            Buffer.from(body, 'base64url').toString('utf8'),
        ) as EmailTrackingPayload;
        if (parsed?.v !== 1 || (parsed.t !== 'o' && parsed.t !== 'c')) {
            return null;
        }
        if (typeof parsed.m !== 'string' || !parsed.m) {
            return null;
        }
        if (parsed.t === 'c' && (typeof parsed.u !== 'string' || !parsed.u)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function buildEmailOpenTrackingUrl(
    apiBase: string,
    messageUuid: string,
    secret: string,
): string {
    const token = createEmailTrackingToken({ v: 1, t: 'o', m: messageUuid }, secret);
    return `${apiBase.replace(/\/$/, '')}/t/o/${token}.gif`;
}

export function buildEmailClickTrackingUrl(
    apiBase: string,
    messageUuid: string,
    destinationUrl: string,
    secret: string,
): string {
    const token = createEmailTrackingToken(
        { v: 1, t: 'c', m: messageUuid, u: destinationUrl },
        secret,
    );
    return `${apiBase.replace(/\/$/, '')}/t/c/${token}`;
}

export function isTrackableHttpUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function shouldSkipClickRewrite(href: string, apiBase: string): boolean {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith('#')) return true;
    const lower = trimmed.toLowerCase();
    if (
        lower.startsWith('mailto:') ||
        lower.startsWith('tel:') ||
        lower.startsWith('sms:') ||
        lower.startsWith('javascript:')
    ) {
        return true;
    }
    if (!isTrackableHttpUrl(trimmed)) return true;
    const base = apiBase.replace(/\/$/, '');
    if (base && trimmed.startsWith(`${base}/t/`)) return true;
    if (/\/unsubscribe\//i.test(trimmed)) return true;
    return false;
}

export function injectEmailOpenPixel(html: string, openUrl: string): string {
    const pixel = `<img src="${openUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none" />`;
    if (/<\/body>/i.test(html)) {
        return html.replace(/<\/body>/i, `${pixel}</body>`);
    }
    return `${html}${pixel}`;
}

export function rewriteEmailLinksForClickTracking(
    html: string,
    apiBase: string,
    messageUuid: string,
    secret: string,
): string {
    return html.replace(
        /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>/gi,
        (match, before: string, quote: string, href: string, after: string) => {
            if (shouldSkipClickRewrite(href, apiBase)) {
                return match;
            }
            const tracked = buildEmailClickTrackingUrl(apiBase, messageUuid, href, secret);
            return `<a${before}href=${quote}${tracked}${quote}${after}>`;
        },
    );
}

export function applySmtpEmailTracking(params: {
    html: string;
    messageUuid: string;
    apiBase: string;
    secret: string;
}): string {
    const { html, messageUuid, apiBase, secret } = params;
    const base = apiBase.replace(/\/$/, '');
    if (!base || !secret) {
        return html;
    }
    const withClicks = rewriteEmailLinksForClickTracking(html, base, messageUuid, secret);
    const openUrl = buildEmailOpenTrackingUrl(base, messageUuid, secret);
    return injectEmailOpenPixel(withClicks, openUrl);
}
