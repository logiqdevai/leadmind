import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import el from "./locales/el";

export const SUPPORTED_LANGUAGES = [
    { code: "en", label: "English", shortLabel: "EN", country: "GB" },
    { code: "el", label: "Ελληνικά", shortLabel: "EL", country: "GR" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const LANGUAGE_STORAGE_KEY = "leadmind.language";
const FALLBACK_LANGUAGE: LanguageCode = "en";

const syncDocumentLanguage = (language: string) => {
    document.documentElement.lang = language;
};

// Order matters: an explicit choice (localStorage) wins, then the browser / device language
// (navigator.languages, so "el-GR" resolves to "el"); anything unsupported falls back to English.
void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: { en: { translation: en }, el: { translation: el } },
        fallbackLng: FALLBACK_LANGUAGE,
        supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
        nonExplicitSupportedLngs: true,
        load: "languageOnly",
        interpolation: { escapeValue: false },
        detection: {
            order: ["localStorage", "navigator", "htmlTag"],
            lookupLocalStorage: LANGUAGE_STORAGE_KEY,
            caches: ["localStorage"],
        },
        returnNull: false,
    });

syncDocumentLanguage(i18n.resolvedLanguage ?? FALLBACK_LANGUAGE);
i18n.on("languageChanged", syncDocumentLanguage);

/** Active language, narrowed to a supported code ("el-GR" -> "el"). */
export const getCurrentLanguage = (): LanguageCode => {
    const code = (i18n.resolvedLanguage ?? i18n.language ?? FALLBACK_LANGUAGE).slice(0, 2);
    return SUPPORTED_LANGUAGES.some((l) => l.code === code) ? (code as LanguageCode) : FALLBACK_LANGUAGE;
};

export default i18n;
