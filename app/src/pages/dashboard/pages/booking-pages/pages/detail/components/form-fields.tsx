import type { FC, ReactNode } from "react";
import { Label, ListBox, NumberField, Select, Switch } from "@heroui/react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
    title: string;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
    actions?: ReactNode;
}

/** Card with the design-system section header (uppercase label + optional actions). */
export const SettingsSection: FC<SettingsSectionProps> = ({ title, description, children, className, actions }) => (
    <section className={cn("rounded-2xl border border-border/80 bg-surface overflow-hidden", className)}>
        <header className="flex items-start justify-between gap-3 border-b border-border/60 bg-surface-secondary/40 px-4 py-3">
            <div className="min-w-0">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</h2>
                {description ? <p className="mt-1 text-xs text-muted max-w-2xl">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
        <div className="space-y-4 p-4">{children}</div>
    </section>
);

interface FieldProps {
    label: string;
    htmlFor?: string;
    description?: ReactNode;
    error?: string;
    required?: boolean;
    children: ReactNode;
    className?: string;
}

export const Field: FC<FieldProps> = ({ label, htmlFor, description, error, required, children, className }) => (
    <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={htmlFor}>
            {label}
            {required ? <span className="text-danger"> *</span> : null}
        </Label>
        {children}
        {error ? (
            <p className="text-xs text-danger">{error}</p>
        ) : description ? (
            <p className="text-xs text-muted">{description}</p>
        ) : null}
    </div>
);

interface SettingSwitchProps {
    label: string;
    description?: ReactNode;
    isSelected: boolean;
    onChange: (value: boolean) => void;
    isDisabled?: boolean;
}

export const SettingSwitch: FC<SettingSwitchProps> = ({ label, description, isSelected, onChange, isDisabled }) => (
    <label
        className={cn(
            "flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-secondary/20 px-3 py-2.5",
            isDisabled ? "cursor-default opacity-80" : "cursor-pointer",
        )}
    >
        <div className="min-w-0">
            <div className="text-sm text-foreground">{label}</div>
            {description ? <p className="text-xs text-muted">{description}</p> : null}
        </div>
        <Switch
            isSelected={isSelected}
            onChange={(v) => onChange(typeof v === "boolean" ? v : !isSelected)}
            isDisabled={isDisabled}
            aria-label={label}
        >
            <Switch.Control>
                <Switch.Thumb />
            </Switch.Control>
        </Switch>
    </label>
);

interface NumberInputProps {
    value: number | null;
    onChange: (value: number | null) => void;
    "aria-label": string;
    minValue?: number;
    maxValue?: number;
    step?: number;
    isDisabled?: boolean;
    className?: string;
    /** Unit shown after the field, e.g. "minutes". */
    suffix?: string;
}

/** Integer input; an emptied field reports `null` (callers decide whether that is allowed). */
export const NumberInput: FC<NumberInputProps> = ({
    value,
    onChange,
    minValue = 0,
    maxValue,
    step = 1,
    isDisabled,
    className,
    suffix,
    "aria-label": ariaLabel,
}) => (
    <div className={cn("flex items-center gap-2", className)}>
        <NumberField
            aria-label={ariaLabel}
            value={value ?? Number.NaN}
            onChange={(next) => onChange(Number.isNaN(next) ? null : Math.round(next))}
            minValue={minValue}
            maxValue={maxValue}
            step={step}
            isDisabled={isDisabled}
            className="w-36"
        >
            <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
            </NumberField.Group>
        </NumberField>
        {suffix ? <span className="text-xs text-muted">{suffix}</span> : null}
    </div>
);

export interface SimpleSelectOption {
    id: string;
    label: string;
    description?: string;
}

interface SimpleSelectProps {
    options: ReadonlyArray<SimpleSelectOption>;
    value: string;
    onChange: (id: string) => void;
    "aria-label": string;
    isDisabled?: boolean;
    className?: string;
}

/** Plain single-choice Select for short, fixed option lists. */
export const SimpleSelect: FC<SimpleSelectProps> = ({
    options,
    value,
    onChange,
    isDisabled,
    className,
    "aria-label": ariaLabel,
}) => (
    <Select
        aria-label={ariaLabel}
        selectedKey={value}
        onSelectionChange={(key) => {
            if (key == null) return;
            onChange(String(key));
        }}
        isDisabled={isDisabled}
        className={cn("w-full sm:max-w-xs", className)}
    >
        <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
            <ListBox>
                {options.map((o) => (
                    <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                        <div className="flex flex-col">
                            <span>{o.label}</span>
                            {o.description ? <span className="text-xs text-muted">{o.description}</span> : null}
                        </div>
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);
