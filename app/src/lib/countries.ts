import { countries } from "country-flag-icons";

export interface CountryItem {
    /** ISO 3166-1 alpha-2 code, e.g. "GR". */
    code: string;
    /** English country name. */
    name: string;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export const getCountryName = (code: string | null | undefined): string => {
    if (!code) return "";
    try {
        return regionNames.of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
};

/** Every country the flag library has a flag for, A-Z by name; codes without a real name (e.g. "AC") are dropped. */
export const COUNTRY_ITEMS: CountryItem[] = countries
    .map((code) => ({ code, name: getCountryName(code) }))
    .filter((item) => item.name !== item.code)
    .sort((a, b) => a.name.localeCompare(b.name));
