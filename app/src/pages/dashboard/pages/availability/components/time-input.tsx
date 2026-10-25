import type { FC } from "react";
import { TimeField, type TimeValue } from "@heroui/react";
import { Time } from "@internationalized/date";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

function toTime(value: string): Time | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    // "24:00" (end of day) can't be shown by the field; show the last minute instead.
    if (h >= 24) return new Time(23, 59);
    return new Time(h, m);
}

interface TimeInputProps {
    /** "HH:MM" (24h). */
    value: string;
    onChange: (value: string) => void;
    "aria-label": string;
    isDisabled?: boolean;
    isInvalid?: boolean;
    className?: string;
}

export const TimeInput: FC<TimeInputProps> = ({ value, onChange, isDisabled, isInvalid, className, "aria-label": ariaLabel }) => (
    <TimeField
        aria-label={ariaLabel}
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        value={toTime(value)}
        onChange={(v: TimeValue | null) => onChange(v ? `${pad(v.hour)}:${pad(v.minute)}` : "")}
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        className={cn("w-24", className)}
    >
        <TimeField.Group>
            <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
    </TimeField>
);
