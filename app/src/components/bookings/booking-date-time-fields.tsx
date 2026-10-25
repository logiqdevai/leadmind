import type { FC } from "react";
import { Calendar, DateField, DatePicker, Label, TimeField } from "@heroui/react";
import { parseDate, Time, type DateValue } from "@internationalized/date";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

const safeParseDate = (value: string): DateValue | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    try {
        return parseDate(value);
    } catch {
        return null;
    }
};

const safeParseTime = (value: string): Time | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return new Time(Number(match[1]), Number(match[2]));
};

interface DateKeyPickerProps {
    /** Local date "YYYY-MM-DD" (timezone independent). */
    value: string;
    onChange: (value: string) => void;
    label?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
    minValue?: string;
    className?: string;
    "aria-label"?: string;
}

/** Date-only picker bound to a "YYYY-MM-DD" key. */
export const DateKeyPicker: FC<DateKeyPickerProps> = ({
    value,
    onChange,
    label,
    isRequired,
    isDisabled,
    minValue,
    className,
    "aria-label": ariaLabel,
}) => {
    const min = minValue ? safeParseDate(minValue) : null;
    return (
        <DatePicker
            className={cn("w-full", className)}
            value={safeParseDate(value)}
            onChange={(next) => {
                if (next) onChange(`${next.year}-${pad(next.month)}-${pad(next.day)}`);
            }}
            minValue={min ?? undefined}
            isDisabled={isDisabled}
            aria-label={ariaLabel ?? label ?? "Date"}
        >
            {label ? (
                <Label>
                    {label}
                    {isRequired ? <span className="text-danger"> *</span> : null}
                </Label>
            ) : null}
            <DateField.Group fullWidth>
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix>
                    <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover className="flex min-w-63 w-auto max-w-none flex-col gap-3">
                <Calendar aria-label="Choose date">
                    <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" aria-label="Previous month" />
                        <Calendar.NavButton slot="next" aria-label="Next month" />
                    </Calendar.Header>
                    <Calendar.Grid>
                        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                            {({ year }) => <Calendar.YearPickerCell year={year} />}
                        </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                </Calendar>
            </DatePicker.Popover>
        </DatePicker>
    );
};

interface TimeOfDayFieldProps {
    /** Wall-clock time "HH:MM" (24h). */
    value: string;
    onChange: (value: string) => void;
    label?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
    className?: string;
    "aria-label"?: string;
}

/** 24h time-of-day field bound to an "HH:MM" string. */
export const TimeOfDayField: FC<TimeOfDayFieldProps> = ({
    value,
    onChange,
    label,
    isRequired,
    isDisabled,
    className,
    "aria-label": ariaLabel,
}) => (
    <TimeField
        className={cn("w-full", className)}
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        value={safeParseTime(value)}
        onChange={(next) => {
            if (next) onChange(`${pad(next.hour)}:${pad(next.minute)}`);
        }}
        isDisabled={isDisabled}
        aria-label={ariaLabel ?? label ?? "Time"}
    >
        {label ? (
            <Label>
                {label}
                {isRequired ? <span className="text-danger"> *</span> : null}
            </Label>
        ) : null}
        <TimeField.Group fullWidth>
            <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
    </TimeField>
);
