import { useMemo, type FC } from "react";
import { LANGUAGE_ITEMS, getLanguageItem } from "@/lib/languages";
import { CountryFlag } from "./country-flag";
import { FlagSelect } from "./flag-select";

interface LanguagePickerProps {
    /** ISO 639-1 code, or null for none. */
    value: string | null;
    onChange: (code: string | null) => void;
    label?: string;
    placeholder?: string;
    /** Text of the entry that clears the language; omit to make a language mandatory. */
    clearLabel?: string;
    description?: string;
    disabled?: boolean;
}

/** Language select with flags, shared across forms. Values are ISO 639-1 codes. */
export const LanguagePicker: FC<LanguagePickerProps> = ({ placeholder = "Select a language", ...props }) => {
    const options = useMemo(() => LANGUAGE_ITEMS.map((l) => ({ value: l.code, label: l.label, flag: l.flag })), []);
    return <FlagSelect aria-label={props.label ?? "Language"} options={options} placeholder={placeholder} {...props} />;
};

/** Read-only flag + language name; unknown codes fall back to the upper-cased code. */
export const LanguageLabel: FC<{ code: string }> = ({ code }) => {
    const item = getLanguageItem(code);
    return (
        <span className="inline-flex items-center gap-2">
            {item ? <CountryFlag code={item.flag} label={item.label} /> : null}
            {item?.label ?? code.toUpperCase()}
        </span>
    );
};
