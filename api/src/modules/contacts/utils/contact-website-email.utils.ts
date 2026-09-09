import type { CrawledPage } from '@/integrations/apify/website-content-crawler/website-content-crawler.interfaces';
import { plainTextFromCrawledPage } from '@/integrations/apify/website-content-crawler/crawl-page-text.utils';
import { normalizeWebsiteUrl } from '@/modules/leads/utils/enrichment-data.utils';
import { resolveReachableWebsiteUrl } from '@/shared/utils/website-reachability.util';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const OBFUSCATED_EMAIL_REGEX =
    /\b([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+|&#64;|@)\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+|\.)\s*([a-zA-Z]{2,})\b/gi;

const EMAIL_PAGE_PATHS = [
    '/',
    '/contact',
    '/contact-us',
    '/about',
] as const;

const JUNK_EMAIL_DOMAINS = new Set([
    'example.com',
    'example.org',
    'example.net',
    'sentry.io',
    'wixpress.com',
    'users.noreply.github.com',
    'email.com',
    'domain.com',
    'yourdomain.com',
    'test.com',
]);

const GENERIC_LOCAL_PARTS = new Set([
    'info',
    'contact',
    'hello',
    'support',
    'sales',
    'admin',
    'office',
    'mail',
    'enquiries',
    'inquiry',
]);

export function isJunkEmail(email: string): boolean {
    const lower = email.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(lower)) {
        return true;
    }
    const domain = lower.split('@')[1] ?? '';
    if (!domain) return true;
    if (JUNK_EMAIL_DOMAINS.has(domain)) return true;
    for (const junk of JUNK_EMAIL_DOMAINS) {
        if (domain.endsWith(`.${junk}`)) return true;
    }
    return false;
}

function collectEmailsFromText(text: string, into: Set<string>): void {
    for (const match of text.matchAll(MAILTO_REGEX)) {
        const email = match[1]?.toLowerCase();
        if (email && !isJunkEmail(email)) into.add(email);
    }

    OBFUSCATED_EMAIL_REGEX.lastIndex = 0;
    for (const match of text.matchAll(OBFUSCATED_EMAIL_REGEX)) {
        const email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase();
        if (!isJunkEmail(email)) into.add(email);
    }

    const matches = text.match(EMAIL_REGEX) ?? [];
    for (const match of matches) {
        const normalized = match.toLowerCase();
        if (!isJunkEmail(normalized)) into.add(normalized);
    }
}

function extractEmailsFromHaystack(haystack: string): string[] {
    const unique = new Set<string>();
    collectEmailsFromText(haystack, unique);
    return [...unique];
}

export async function buildWebsiteEmailCrawlUrls(website: string): Promise<string[]> {
    const normalized = normalizeWebsiteUrl(website.trim());
    let origin: string;
    try {
        const parsed = new URL(normalized);
        origin = `${parsed.protocol}//${parsed.host}`;
    } catch {
        return [normalized];
    }

    // Some sites only serve content on one of example.com / www.example.com and don't redirect
    // the other form, so resolve which host actually answers before building the candidate list.
    const resolvedOrigin = await resolveOrigin(origin);
    const resolvedNormalized = resolvedOrigin === origin ? normalized : normalized.replace(origin, resolvedOrigin);

    const urls = EMAIL_PAGE_PATHS.map((path) => `${resolvedOrigin}${path === '/' ? '/' : path}`);
    const withoutTrailingSlash = resolvedNormalized.replace(/\/$/, '');
    if (
        withoutTrailingSlash !== resolvedOrigin &&
        !urls.includes(resolvedNormalized) &&
        !urls.includes(withoutTrailingSlash)
    ) {
        urls.unshift(resolvedNormalized);
    }
    return [...new Set(urls)];
}

async function resolveOrigin(origin: string): Promise<string> {
    const resolvedUrl = await resolveReachableWebsiteUrl(origin);
    try {
        const parsed = new URL(resolvedUrl);
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return origin;
    }
}

export function extractEmailsFromCrawledPage(page: CrawledPage | null): string[] {
    if (!page) return [];
    const parts = [page.title, page.markdown, page.text, page.html, plainTextFromCrawledPage(page)].filter(
        Boolean,
    );
    return extractEmailsFromHaystack(parts.join('\n'));
}

export function extractEmailsFromCrawledPages(pages: CrawledPage[]): string[] {
    const unique = new Set<string>();
    for (const page of pages) {
        for (const email of extractEmailsFromCrawledPage(page)) {
            unique.add(email);
        }
    }
    return [...unique];
}

/**
 * Drops obvious non-emails (asset filenames, placeholder domains) from a list of candidate
 * addresses. Needed for providers like Scrapio whose built-in regex extractor has no notion of
 * what counts as junk — e.g. it matches retina image filenames like `logo@2x.png` as "emails".
 */
export function filterJunkEmails(emails: string[]): string[] {
    return emails.filter((email) => !isJunkEmail(email));
}

export function pickBestContactEmail(emails: string[]): string | null {
    if (emails.length === 0) return null;
    if (emails.length === 1) return emails[0]!;

    const personal = emails.filter((email) => {
        const local = email.split('@')[0] ?? '';
        return local.length > 0 && !GENERIC_LOCAL_PARTS.has(local);
    });
    if (personal.length > 0) return personal[0]!;

    const generic = emails.filter((email) => {
        const local = email.split('@')[0] ?? '';
        return GENERIC_LOCAL_PARTS.has(local);
    });
    if (generic.length > 0) return generic[0]!;

    return emails[0]!;
}
