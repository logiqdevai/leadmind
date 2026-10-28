import { CountryOptions } from "@/config/constants/dropdowns/country.options";

export interface LanguageItem {
    /** ISO 639-1 code, e.g. "el". */
    code: string;
    /** English language name. */
    label: string;
    /** Country whose flag represents the language. */
    flag: string;
}

/** Languages whose flag should not be that of the first country speaking them. */
const FLAG_OVERRIDES: Record<string, string> = { en: "GB" };

/** Every language of the countries in the shared country options, A-Z by name. */
export const LANGUAGE_ITEMS: LanguageItem[] = (() => {
    const byCode = new Map<string, LanguageItem>();
    for (const option of CountryOptions) {
        if (!byCode.has(option.language_value)) {
            byCode.set(option.language_value, {
                code: option.language_value,
                label: option.language_label,
                flag: FLAG_OVERRIDES[option.language_value] ?? option.value,
            });
        }
    }
    return [...byCode.values()].sort((a, b) => a.label.localeCompare(b.label));
})();

export const getLanguageItem = (code: string | null | undefined): LanguageItem | undefined =>
    LANGUAGE_ITEMS.find((item) => item.code === code?.toLowerCase());
