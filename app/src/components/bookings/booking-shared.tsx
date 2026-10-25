import type { FC, ReactNode } from "react";
import { Chip, Label, ListBox, Select, Switch } from "@heroui/react";
import { cn } from "@/lib/utils";
import type { SimpleOption } from "./utils/booking-options";
import { BOOKING_STATUS_CHIP_COLORS, BOOKING_STATUS_LABELS } from "@/features/bookings/constants/booking-labels";
import type { BookingStatus } from "@/features/bookings/interfaces/bookings.interfaces";

export const BookingStatusChip: FC<{ status: BookingStatus; className?: string }> = ({ status, className }) => (
    <Chip size="sm" variant="soft" color={BOOKING_STATUS_CHIP_COLORS[status]} className={cn("shrink-0", className)}>
        <Chip.Label>{BOOKING_STATUS_LABELS[status]}</Chip.Label>
    </Chip>
);

interface SwitchRowProps {
    isSelected: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description?: string;
    isDisabled?: boolean;
}

/** Switch with a label and optional helper line. */
export const SwitchRow: FC<SwitchRowProps> = ({ isSelected, onChange, label, description, isDisabled }) => (
    <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {description ? <p className="text-xs text-muted mt-0.5">{description}</p> : null}
        </div>
        <Switch
            isSelected={isSelected}
            onChange={(v) => onChange(typeof v === "boolean" ? v : !isSelected)}
            isDisabled={isDisabled}
            aria-label={label}
            className="shrink-0"
        >
            <Switch.Control>
                <Switch.Thumb />
            </Switch.Control>
        </Switch>
    </div>
);

interface OptionSelectProps {
    options: ReadonlyArray<SimpleOption>;
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    isDisabled?: boolean;
    className?: string;
    "aria-label": string;
}

/** Plain single-choice Select for short, static option lists. */
export const OptionSelect: FC<OptionSelectProps> = ({
    options,
    value,
    onChange,
    label,
    placeholder,
    isDisabled,
    className,
    "aria-label": ariaLabel,
}) => (
    <Select
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(v) => onChange(v == null ? "" : String(v))}
        isDisabled={isDisabled}
        className={className}
    >
        {label ? <Label>{label}</Label> : null}
        <Select.Trigger className="w-full">
            <Select.Value />
            <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
            <ListBox>
                {options.map((opt) => (
                    <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                        {opt.label}
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

/** Label + value pair used in detail panels. */
export const DetailRow: FC<{ label: string; children: ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={cn("flex flex-col gap-0.5 min-w-0", className)}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
        <div className="text-sm text-foreground min-w-0 break-words">{children}</div>
    </div>
);
