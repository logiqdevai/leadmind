import type { FC } from "react";
import { Label, ListBox, Select } from "@heroui/react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "./country-flag";

export interface FlagSelectOption {
    value: string;
    label: string;
    /** Country code whose flag is shown next to the label. */
    flag: string;
}

interface FlagSelectProps {
    options: FlagSelectOption[];
    value: string | null;
    onChange: (value: string | null) => void;
    "aria-label": string;
    label?: string;
    placeholder?: string;
    /** When set, a first entry with this text clears the selection (onChange(null)). */
    clearLabel?: string;
    disabled?: boolean;
    description?: string;
}

const NONE_KEY = "__none__";

/** Select whose entries carry a flag; the shared base of the country and language pickers. */
export const FlagSelect: FC<FlagSelectProps> = ({
    options,
    value,
    onChange,
    label,
    placeholder = "Select…",
    clearLabel,
    disabled = false,
    description,
    ...rest
}) => (
    <div className="space-y-1.5">
        {label ? <Label className="text-sm text-foreground">{label}</Label> : null}
        <Select
            aria-label={rest["aria-label"]}
            placeholder={placeholder}
            selectedKey={value ?? (clearLabel ? NONE_KEY : null)}
            onSelectionChange={(key) => {
                if (key === NONE_KEY) onChange(null);
                else if (typeof key === "string" && key) onChange(key);
            }}
            isDisabled={disabled}
            fullWidth
        >
            <Select.Trigger
                className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-surface-primary",
                    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
                )}
            >
                <Select.Value className="min-w-0 flex-1 overflow-hidden" />
                <Select.Indicator className="shrink-0" />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {clearLabel ? (
                        <ListBox.Item id={NONE_KEY} textValue={clearLabel}>
                            {clearLabel}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ) : null}
                    {options.map((option) => (
                        <ListBox.Item
                            key={option.value}
                            id={option.value}
                            textValue={option.label}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                        >
                            <span className="flex min-w-0 items-center gap-2.5 overflow-hidden leading-none">
                                <CountryFlag code={option.flag} label={option.label} />
                                <span className="truncate">{option.label}</span>
                            </span>
                            <ListBox.ItemIndicator className="shrink-0" />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
    </div>
);
