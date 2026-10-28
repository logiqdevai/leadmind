/** Main language (ISO 639-1) of each country the app's country picker offers a language for. */
const COUNTRY_LANGUAGE: Record<string, string> = {
    AT: 'de',
    BE: 'nl',
    BG: 'bg',
    HR: 'hr',
    CY: 'el',
    CZ: 'cs',
    DK: 'da',
    EE: 'et',
    FI: 'fi',
    FR: 'fr',
    DE: 'de',
    GR: 'el',
    HU: 'hu',
    IE: 'en',
    IT: 'it',
    LV: 'lv',
    LT: 'lt',
    LU: 'fr',
    MT: 'mt',
    NL: 'nl',
    PL: 'pl',
    PT: 'pt',
    RO: 'ro',
    SK: 'sk',
    SI: 'sl',
    ES: 'es',
    SE: 'sv',
    GB: 'en',
    US: 'en',
    AU: 'en',
    NZ: 'en',
};

/** Main language of an ISO 3166-1 alpha-2 country code, or null when unknown. */
export function languageForCountry(country: string | null | undefined): string | null {
    if (!country) return null;
    return COUNTRY_LANGUAGE[country.trim().toUpperCase()] ?? null;
}

/** Normalises "el-GR" / "EL" to "el"; null for anything that is not a language code. */
export function normalizeLanguageCode(value: string | null | undefined): string | null {
    const code = value?.trim().toLowerCase().split(/[-_]/)[0];
    return code && /^[a-z]{2,3}$/.test(code) ? code : null;
}
