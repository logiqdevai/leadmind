import { resolveMx } from 'dns/promises';
import { EmailValidationStatus } from '@/generated/prisma';
import { hasUsableContactEmail, normalizeContactEmail } from '@/shared/utils/contact-email.util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DISPOSABLE_DOMAINS: string[] = require('disposable-email-domains');
const DISPOSABLE_DOMAIN_SET = new Set(DISPOSABLE_DOMAINS.map((d) => d.toLowerCase()));

const MX_LOOKUP_TIMEOUT_MS = 5000;

export interface EmailValidationResult {
    status: EmailValidationStatus;
    reason: string | null;
}

export interface EmailValidationFields {
    email: string;
    email_validation_status: EmailValidationStatus;
    email_validation_reason: string | null;
    email_validated_at: Date;
}

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
    if (DISPOSABLE_DOMAIN_SET.has(domain)) {
        return { status: EmailValidationStatus.INVALID, reason: 'disposable_domain' };
    }

    try {
        const records = await resolveMxWithTimeout(domain);
        return records.length > 0
            ? { status: EmailValidationStatus.VALID, reason: null }
            : { status: EmailValidationStatus.INVALID, reason: 'no_mx_record' };
    } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code;
        return code === 'ENOTFOUND' || code === 'ENODATA'
            ? { status: EmailValidationStatus.INVALID, reason: 'no_mx_record' }
            : { status: EmailValidationStatus.UNKNOWN, reason: 'dns_lookup_failed' };
    }
}

/**
 * Runs the email checks (syntax, disposable-domain blocklist, MX record lookup)
 * against a single address. No caching — every call does a fresh lookup.
 */
export async function validateEmailAddress(
    email: string | null | undefined,
): Promise<EmailValidationResult> {
    const normalized = normalizeContactEmail(email);
    if (!normalized || !hasUsableContactEmail(normalized)) {
        return { status: EmailValidationStatus.INVALID, reason: 'invalid_syntax' };
    }

    return validateDomain(getDomain(normalized));
}

/**
 * Validates a candidate email and resolves the fields to persist on a Lead/Contact
 * create or update. Returns null when the address fails validation (or none was
 * given) — callers should omit these fields from the write entirely in that case,
 * leaving whatever the record already had untouched rather than storing a
 * known-bad address.
 */
export async function resolveEmailFieldsForWrite(
    email: string | null | undefined,
): Promise<EmailValidationFields | null> {
    const normalized = normalizeContactEmail(email);
    if (!normalized) return null;

    const result = await validateEmailAddress(normalized);
    if (result.status === EmailValidationStatus.INVALID) return null;

    return {
        email: normalized,
        email_validation_status: result.status,
        email_validation_reason: result.reason,
        email_validated_at: new Date(),
    };
}
