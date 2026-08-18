import { EmailValidationStatus } from '@/generated/prisma';

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContactEmail(
    email: string | null | undefined,
): string | null {
    if (email == null) return null;
    const trimmed = email.trim();
    if (trimmed.length === 0) return null;

    // Scrapers/enrichment occasionally store more than one guessed address in
    // a single field, joined by a comma or semicolon (e.g. two spelling
    // variants of the same person's email). Rather than reject the whole
    // field as malformed, pick the first candidate that looks like a single
    // address.
    if (/[,;]/.test(trimmed)) {
        const candidates = trimmed
            .split(/[,;]+/)
            .map((c) => c.trim())
            .filter(Boolean);
        const usable = candidates.find((c) => BASIC_EMAIL_REGEX.test(c));
        return usable ?? candidates[0] ?? trimmed;
    }

    return trimmed;
}

export function hasUsableContactEmail(
    email: string | null | undefined,
): boolean {
    const normalized = normalizeContactEmail(email);
    if (!normalized) return false;
    return BASIC_EMAIL_REGEX.test(normalized);
}

export function isEmailValidationBlocked(
    status: EmailValidationStatus | null | undefined,
): boolean {
    return status === EmailValidationStatus.INVALID;
}
