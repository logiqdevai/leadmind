import { useMemo, type FC } from "react";
import { COUNTRY_ITEMS, getCountryName } from "@/lib/countries";
import { CountryFlag } from "./country-flag";
import { FlagSelect } from "./flag-select";

interface CountryPickerProps {
    /** ISO 3166-1 alpha-2 code, or null for none. */
    value: string | null;
    onChange: (code: string | null) => void;
    label?: string;
    placeholder?: string;
    /** Text of the entry that clears the country; omit to make a country mandatory. */
    clearLabel?: string;
    description?: string;
    disabled?: boolean;
}

/** Country select with flags, shared across forms. Values are ISO 3166-1 alpha-2 codes. */
export const CountryPicker: FC<CountryPickerProps> = ({ placeholder = "Select a country", ...props }) => {
    const options = useMemo(() => COUNTRY_ITEMS.map((c) => ({ value: c.code, label: c.name, flag: c.code })), []);
    return <FlagSelect aria-label={props.label ?? "Country"} options={options} placeholder={placeholder} {...props} />;
};

/** Read-only flag + country name. */
export const CountryLabel: FC<{ code: string }> = ({ code }) => (
    <span className="inline-flex items-center gap-2">
        <CountryFlag code={code} label={getCountryName(code)} />
        {getCountryName(code)}
    </span>
);
