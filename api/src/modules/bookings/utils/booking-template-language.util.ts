import { languageForCountry, normalizeLanguageCode } from '@/shared/utils/country-language.util';

/** Used when no template matches the recipient's language (or the language is unknown). */
export const FALLBACK_TEMPLATE_LANGUAGE = 'en';

/**
 * The language to write to an invitee: their contact's country language first, then the language they used on the
 * booking page. Null when neither is known.
 */
export function resolveRecipientLanguage(input: {
    contact_country?: string | null;
    invitee_language?: string | null;
}): string | null {
    return languageForCountry(input.contact_country) ?? normalizeLanguageCode(input.invitee_language);
}

/**
 * Picks the template to send out of those a booking page offers for one email type: the one written in the
 * recipient's language, else the English one, else the first. Null when the page offers none (built-in default is used).
 */
export function pickTemplateForLanguage<T extends { language: string }>(candidates: T[], language: string | null): T | null {
    if (candidates.length === 0) return null;
    const byLanguage = (code: string) => candidates.find((c) => normalizeLanguageCode(c.language) === code);
    return (language ? byLanguage(language) : undefined) ?? byLanguage(FALLBACK_TEMPLATE_LANGUAGE) ?? candidates[0];
}
