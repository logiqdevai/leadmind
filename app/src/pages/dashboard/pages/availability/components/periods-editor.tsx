import type { FC } from "react";
import { Button } from "@heroui/react";
import { Plus, X } from "lucide-react";
import type { TimeRange } from "@/features/bookings/interfaces/bookings.interfaces";
import { DEFAULT_PERIOD, sortPeriods, timeToMinutes } from "@/pages/dashboard/pages/availability/utils/time-ranges";
import { TimeInput } from "./time-input";

const pad = (n: number) => String(n).padStart(2, "0");
const minutesToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Next period after the last one: one hour later, two hours long, capped at 23:59. */
function nextPeriod(periods: TimeRange[]): TimeRange {
    if (periods.length === 0) return { ...DEFAULT_PERIOD };
    const lastEnd = Math.max(...periods.map((p) => timeToMinutes(p.end)));
    const start = Math.min(lastEnd + 60, 22 * 60);
    return { start: minutesToTime(start), end: minutesToTime(Math.min(start + 120, 23 * 60 + 59)) };
}

interface PeriodsEditorProps {
    value: TimeRange[];
    onChange: (value: TimeRange[]) => void;
    label: string;
    isDisabled?: boolean;
    error?: string;
}

export const PeriodsEditor: FC<PeriodsEditorProps> = ({ value, onChange, label, isDisabled, error }) => {
    const update = (index: number, patch: Partial<TimeRange>) =>
        onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));

    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
                {value.map((p, index) => (
                    <div key={index} className="flex items-center gap-1 rounded-xl bg-surface-secondary/30 py-0.5 pl-1 pr-0.5">
                        <TimeInput
                            aria-label={`${label} period ${index + 1} start`}
                            value={p.start}
                            onChange={(start) => update(index, { start })}
                            isDisabled={isDisabled}
                            isInvalid={!!error}
                        />
                        <span className="text-xs text-muted">to</span>
                        <TimeInput
                            aria-label={`${label} period ${index + 1} end`}
                            value={p.end}
                            onChange={(end) => update(index, { end })}
                            isDisabled={isDisabled}
                            isInvalid={!!error}
                        />
                        {!isDisabled && value.length > 1 ? (
                            <Button
                                size="sm"
                                variant="tertiary"
                                aria-label={`Remove ${label} period ${index + 1}`}
                                className="min-w-7 px-1"
                                onPress={() => onChange(value.filter((_, i) => i !== index))}
                            >
                                <X className="size-3.5" />
                            </Button>
                        ) : null}
                    </div>
                ))}
                {!isDisabled ? (
                    <Button
                        size="sm"
                        variant="tertiary"
                        aria-label={`Add ${label} period`}
                        onPress={() => onChange(sortPeriods([...value, nextPeriod(value)]))}
                    >
                        <Plus className="size-3.5" />
                        Period
                    </Button>
                ) : null}
            </div>
            {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
    );
};
