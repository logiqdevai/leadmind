import { useState, type FC } from "react";
import { Button } from "@heroui/react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberInput, SimpleSelect } from "./form-fields";

export interface NumberPreset {
    value: number;
    label: string;
}

const chipClass = (selected: boolean, disabled?: boolean) =>
    cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-200",
        selected
            ? "border-accent/60 bg-accent/12 text-foreground"
            : "border-border bg-surface-secondary/30 text-muted",
        !disabled && !selected && "hover:text-foreground hover:bg-surface-secondary",
        disabled ? "cursor-default" : "cursor-pointer",
    );

interface PresetSinglePickerProps {
    presets: ReadonlyArray<NumberPreset>;
    value: number;
    onChange: (value: number) => void;
    "aria-label": string;
    minValue?: number;
    maxValue?: number;
    suffix?: string;
    isDisabled?: boolean;
}

/** One value from presets, or "Custom" with a number field. */
export const PresetSinglePicker: FC<PresetSinglePickerProps> = ({
    presets,
    value,
    onChange,
    minValue = 1,
    maxValue,
    suffix,
    isDisabled,
    "aria-label": ariaLabel,
}) => {
    const isPreset = presets.some((p) => p.value === value);
    const [customOpen, setCustomOpen] = useState(!isPreset);
    const showCustom = customOpen || !isPreset;

    return (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={ariaLabel}>
            {presets.map((p) => {
                const selected = !showCustom && value === p.value;
                return (
                    <button
                        key={p.value}
                        type="button"
                        disabled={isDisabled}
                        aria-pressed={selected}
                        className={chipClass(selected, isDisabled)}
                        onClick={() => {
                            setCustomOpen(false);
                            onChange(p.value);
                        }}
                    >
                        {p.label}
                    </button>
                );
            })}
            <button
                type="button"
                disabled={isDisabled}
                aria-pressed={showCustom}
                className={chipClass(showCustom, isDisabled)}
                onClick={() => setCustomOpen(true)}
            >
                Custom
            </button>
            {showCustom ? (
                <NumberInput
                    aria-label={`${ariaLabel} (custom)`}
                    value={value}
                    onChange={(v) => onChange(v ?? minValue)}
                    minValue={minValue}
                    maxValue={maxValue}
                    suffix={suffix}
                    isDisabled={isDisabled}
                />
            ) : null}
        </div>
    );
};

interface PresetMultiPickerProps {
    presets: ReadonlyArray<NumberPreset>;
    value: number[];
    onChange: (value: number[]) => void;
    formatLabel: (value: number) => string;
    "aria-label": string;
    /** Custom values are typed in this unit and stored multiplied by `customFactor`. */
    customSuffix: string;
    customFactor?: number;
    minValue?: number;
    maxValue?: number;
    isDisabled?: boolean;
    /** Value that can't be removed (e.g. the default duration). */
    lockedValue?: number;
    sort?: "asc" | "desc";
}

/** Toggle presets on/off and add custom values. */
export const PresetMultiPicker: FC<PresetMultiPickerProps> = ({
    presets,
    value,
    onChange,
    formatLabel,
    customSuffix,
    customFactor = 1,
    minValue = 1,
    maxValue,
    isDisabled,
    lockedValue,
    sort = "asc",
    "aria-label": ariaLabel,
}) => {
    const [custom, setCustom] = useState<number | null>(null);
    const selected = new Set(value);
    const customValues = value.filter((v) => !presets.some((p) => p.value === v));
    const order = (list: number[]) => [...new Set(list)].sort((a, b) => (sort === "asc" ? a - b : b - a));

    const toggle = (v: number) => {
        if (v === lockedValue) return;
        onChange(order(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]));
    };

    const addCustom = () => {
        if (custom == null) return;
        onChange(order([...value, custom * customFactor]));
        setCustom(null);
    };

    return (
        <div className="space-y-2" role="group" aria-label={ariaLabel}>
            <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((p) => {
                    const isOn = selected.has(p.value);
                    return (
                        <button
                            key={p.value}
                            type="button"
                            disabled={isDisabled || p.value === lockedValue}
                            aria-pressed={isOn}
                            className={chipClass(isOn, isDisabled)}
                            onClick={() => toggle(p.value)}
                        >
                            {p.label}
                        </button>
                    );
                })}
                {customValues.map((v) => (
                    <span key={v} className={chipClass(true, true)}>
                        {formatLabel(v)}
                        {!isDisabled && v !== lockedValue ? (
                            <button
                                type="button"
                                aria-label={`Remove ${formatLabel(v)}`}
                                className="cursor-pointer text-muted hover:text-danger"
                                onClick={() => toggle(v)}
                            >
                                <X className="size-3" />
                            </button>
                        ) : null}
                    </span>
                ))}
            </div>
            {!isDisabled ? (
                <div className="flex items-center gap-2">
                    <NumberInput
                        aria-label={`Custom ${ariaLabel}`}
                        value={custom}
                        onChange={setCustom}
                        minValue={minValue}
                        maxValue={maxValue}
                        suffix={customSuffix}
                    />
                    <Button size="sm" variant="secondary" isDisabled={custom == null} onPress={addCustom}>
                        <Plus className="size-3.5" />
                        Add
                    </Button>
                </div>
            ) : null}
        </div>
    );
};

const SPAN_UNITS = [
    { id: "minutes", label: "minutes", factor: 1 },
    { id: "hours", label: "hours", factor: 60 },
    { id: "days", label: "days", factor: 1440 },
] as const;

type SpanUnitId = (typeof SPAN_UNITS)[number]["id"];

const unitFor = (minutes: number): SpanUnitId => {
    if (minutes > 0 && minutes % 1440 === 0) return "days";
    if (minutes > 0 && minutes % 60 === 0) return "hours";
    return "minutes";
};

interface MinutesSpanInputProps {
    /** Always in minutes. */
    value: number;
    onChange: (minutes: number) => void;
    "aria-label": string;
    isDisabled?: boolean;
}

/** Number + unit (minutes / hours / days), stored as minutes. */
export const MinutesSpanInput: FC<MinutesSpanInputProps> = ({ value, onChange, isDisabled, "aria-label": ariaLabel }) => {
    const [unit, setUnit] = useState<SpanUnitId>(() => unitFor(value));
    const factor = SPAN_UNITS.find((u) => u.id === unit)?.factor ?? 1;
    const amount = Math.round((value / factor) * 100) / 100;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <NumberInput
                aria-label={ariaLabel}
                value={amount}
                onChange={(v) => onChange(Math.round((v ?? 0) * factor))}
                minValue={0}
                isDisabled={isDisabled}
            />
            <SimpleSelect
                aria-label={`${ariaLabel} unit`}
                options={SPAN_UNITS.map((u) => ({ id: u.id, label: u.label }))}
                value={unit}
                onChange={(id) => setUnit(id as SpanUnitId)}
                isDisabled={isDisabled}
                className="w-32 sm:w-32"
            />
        </div>
    );
};
