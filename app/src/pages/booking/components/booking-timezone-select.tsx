import { useMemo, type FC } from "react";
import { SearchSelect } from "@/components/ui/search-select";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";

interface BookingTimezoneSelectProps {
    value: string;
    onChange: (timezone: string) => void;
    isDisabled?: boolean;
}

/** Timezone dropdown; the visitor's own zone is offered even when it is not in the shared option list. */
export const BookingTimezoneSelect: FC<BookingTimezoneSelectProps> = ({ value, onChange, isDisabled }) => {
    const options = useMemo(() => {
        const base = TimezoneOptions.map((o) => ({ id: o.value as string, label: o.label as string }));
        return base.some((o) => o.id === value) ? base : [{ id: value, label: value.replace(/_/g, " ") }, ...base];
    }, [value]);

    return (
        <SearchSelect
            aria-label="Timezone"
            searchPlaceholder="Search timezones…"
            options={options}
            value={value}
            onChange={onChange}
            isDisabled={isDisabled}
            fullWidth
        />
    );
};
