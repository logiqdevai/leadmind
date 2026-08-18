import { resolveMx } from 'dns/promises';
import { EmailValidationStatus } from '@/generated/prisma';
import { hasUsableContactEmail, normalizeContactEmail } from '@/shared/utils/contact-email.util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DISPOSABLE_DOMAINS: string[] = require('disposable-email-domains');
const DISPOSABLE_DOMAIN_SET = new Set(DISPOSABLE_DOMAINS.map((d) => d.toLowerCase()));

const MX_LOOKUP_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface EmailValidationResult {
    status: EmailValidationStatus;
    reason: string | null;
}

const domainResultCache = new Map<string, { result: EmailValidationResult; expiresAt: number }>();

function getDomain(email: string): string {
    return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

async function resolveMxWithTimeout(domain: string) {
    let timer: NodeJS.Timeout;
    try {
        return await Promise.race([
            resolveMx(domain),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('mx_lookup_timeout')), MX_LOOKUP_TIMEOUT_MS);
            }),
        ]);
    } finally {
        clearTimeout(timer!);
    }
}

async function validateDomain(domain: string): Promise<EmailValidationResult> {
    const cached = domainResultCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
    }

    let result: EmailValidationResult;
    if (DISPOSABLE_DOMAIN_SET.has(domain)) {
        result = { status: EmailValidationStatus.INVALID, reason: 'disposable_domain' };
    } else {
        try {
            const records = await resolveMxWithTimeout(domain);
            result =
                records.length > 0
                    ? { status: EmailValidationStatus.VALID, reason: null }
                    : { status: EmailValidationStatus.INVALID, reason: 'no_mx_record' };
        } catch (error) {
            const code = (error as NodeJS.ErrnoException)?.code;
            result =
                code === 'ENOTFOUND' || code === 'ENODATA'
                    ? { status: EmailValidationStatus.INVALID, reason: 'no_mx_record' }
                    : { status: EmailValidationStatus.UNKNOWN, reason: 'dns_lookup_failed' };
        }
    }

    domainResultCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
}

export async function validateEmailAddress(
    email: string | null | undefined,
): Promise<EmailValidationResult> {
    const normalized = normalizeContactEmail(email);
    if (!normalized || !hasUsableContactEmail(normalized)) {
        return { status: EmailValidationStatus.INVALID, reason: 'invalid_syntax' };
    }

    return validateDomain(getDomain(normalized));
}
