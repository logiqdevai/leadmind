import { resolve4, resolve6, resolveNs } from 'dns/promises';
import { DomainValidationStatus } from '@/generated/prisma';

const DNS_LOOKUP_TIMEOUT_MS = 5000;

const HOSTNAME_REGEX =
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export interface DomainValidationResult {
    status: DomainValidationStatus;
    reason: string | null;
}

export interface WebsiteValidationFields {
    website: string;
    website_validation_status: DomainValidationStatus;
    website_validation_reason: string | null;
    website_validated_at: Date;
}

/**
 * Extracts a clean, comparable hostname from a website value that may or may
 * not already have a protocol, `www.`, path, casing, etc.
 */
export function extractDomainHost(website: string | null | undefined): string | null {
    if (!website) return null;
    const trimmed = website.trim();
    if (!trimmed) return null;

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const host = new URL(withProtocol).hostname
            .toLowerCase()
            .replace(/^www\./, '')
            .replace(/\.$/, '');
        return host || null;
    } catch {
        return null;
    }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('dns_lookup_timeout')), ms);
            }),
        ]);
    } finally {
        clearTimeout(timer!);
    }
}

function isNotFound(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException)?.code;
    return code === 'ENOTFOUND' || code === 'ENODATA';
}

/**
 * Confirms a hostname actually exists on the internet. Tries A, then AAAA,
 * then falls back to NS records (a domain that's registered but doesn't
 * serve a website directly, e.g. parked behind a subdomain). Any DNS error
 * other than "no such domain" fails open to UNKNOWN, same as the email
 * MX-record check.
 */
async function validateDomainDns(host: string): Promise<DomainValidationResult> {
    try {
        const records = await withTimeout(resolve4(host), DNS_LOOKUP_TIMEOUT_MS);
        if (records.length > 0) return { status: DomainValidationStatus.VALID, reason: null };
    } catch (error) {
        if (!isNotFound(error)) {
            return { status: DomainValidationStatus.UNKNOWN, reason: 'dns_lookup_failed' };
        }
    }

    try {
        const records = await withTimeout(resolve6(host), DNS_LOOKUP_TIMEOUT_MS);
        if (records.length > 0) return { status: DomainValidationStatus.VALID, reason: null };
    } catch (error) {
        if (!isNotFound(error)) {
            return { status: DomainValidationStatus.UNKNOWN, reason: 'dns_lookup_failed' };
        }
    }

    try {
        const records = await withTimeout(resolveNs(host), DNS_LOOKUP_TIMEOUT_MS);
        return records.length > 0
            ? { status: DomainValidationStatus.VALID, reason: null }
            : { status: DomainValidationStatus.INVALID, reason: 'domain_not_found' };
    } catch (error) {
        return isNotFound(error)
            ? { status: DomainValidationStatus.INVALID, reason: 'domain_not_found' }
            : { status: DomainValidationStatus.UNKNOWN, reason: 'dns_lookup_failed' };
    }
}

/**
 * Runs the domain checks (syntax, DNS existence) against a single website
 * value. No caching — every call does a fresh lookup.
 */
export async function validateWebsiteDomain(
    website: string | null | undefined,
): Promise<DomainValidationResult> {
    const host = extractDomainHost(website);
    if (!host || !HOSTNAME_REGEX.test(host)) {
        return { status: DomainValidationStatus.INVALID, reason: 'invalid_syntax' };
    }

    return validateDomainDns(host);
}

/**
 * Validates a candidate website and resolves the fields to persist on a
 * Lead/Contact create or update. Returns null when the value fails
 * validation (or none was given) — callers should omit these fields from
 * the write entirely in that case, leaving whatever the record already had
 * untouched rather than storing a known-bad domain.
 */
export async function resolveWebsiteFieldsForWrite(
    website: string | null | undefined,
): Promise<WebsiteValidationFields | null> {
    const host = extractDomainHost(website);
    if (!host) return null;
    if (!HOSTNAME_REGEX.test(host)) return null;

    const result = await validateDomainDns(host);
    if (result.status === DomainValidationStatus.INVALID) return null;

    return {
        website: host,
        website_validation_status: result.status,
        website_validation_reason: result.reason,
        website_validated_at: new Date(),
    };
}
