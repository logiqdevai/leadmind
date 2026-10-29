import { useMemo, type FC } from "react";
import { Button, Calendar, DateField, DatePicker, Label } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseDate, Time, type DateValue } from "@internationalized/date";
import { cn } from "@/lib/utils";
import { OptionSelect } from "./booking-shared";

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
    /** Adds previous/next day arrows around the field and shows the weekday. */
    showDayStepper?: boolean;
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
    showDayStepper,
    className,
    "aria-label": ariaLabel,
}) => {
    const min = useMemo(() => (minValue ? safeParseDate(minValue) : null), [minValue]);
    // Stable identity: a fresh object on every render makes the field discard what the user is typing.
    const dateValue = useMemo(() => safeParseDate(value), [value]);

    const picker = <DateKeyPickerField
        value={value}
        dateValue={dateValue}
        onChange={onChange}
        label={label}
        isRequired={isRequired}
        isDisabled={isDisabled}
        min={min}
        className={showDayStepper ? "min-w-0 flex-1" : className}
        ariaLabel={ariaLabel}
    />;
    if (!showDayStepper) return picker;

    const weekday = dateValue
        ? new Date(Date.UTC(dateValue.year, dateValue.month - 1, dateValue.day)).toLocaleDateString(undefined, {
              weekday: "long",
              timeZone: "UTC",
          })
        : null;
    const step = (days: number) => {
        if (!dateValue) return;
        const next = dateValue.add({ days });
        if (min && next.compare(min) < 0) return;
        onChange(`${next.year}-${pad(next.month)}-${pad(next.day)}`);
    };
    const atMin = !!dateValue && !!min && dateValue.add({ days: -1 }).compare(min) < 0;

    return (
        <div className={cn("flex w-full flex-col gap-1.5", className)}>
            <div className="flex items-end gap-1.5">
                <Button
                    isIconOnly
                    size="md"
                    variant="tertiary"
                    aria-label="Previous day"
                    isDisabled={isDisabled || !dateValue || atMin}
                    onPress={() => step(-1)}
                >
                    <ChevronLeft className="size-4" />
                </Button>
                {picker}
                <Button
                    isIconOnly
                    size="md"
                    variant="tertiary"
                    aria-label="Next day"
                    isDisabled={isDisabled || !dateValue}
                    onPress={() => step(1)}
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>
            {weekday ? <p className="text-center text-xs font-medium text-muted">{weekday}</p> : null}
        </div>
    );
};

interface DateKeyPickerFieldProps {
    value: string;
    dateValue: DateValue | null;
    onChange: (value: string) => void;
    label?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
    min: DateValue | null;
    className?: string;
    ariaLabel?: string;
}

const DateKeyPickerField: FC<DateKeyPickerFieldProps> = ({
    dateValue,
    onChange,
    label,
    isRequired,
    isDisabled,
    min,
    className,
    ariaLabel,
}) => {
    return (
        <DatePicker
            className={cn("w-full", className)}
            value={dateValue}
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
    /** Minutes between listed times. */
    stepMinutes?: number;
    className?: string;
    "aria-label"?: string;
}

const timeOptions = (step: number, current: string) => {
    const times: string[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += step) times.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
    // A time that is not on the grid (e.g. from clicking a calendar cell) stays selectable.
    if (safeParseTime(current) && !times.includes(current)) times.push(current);
    return times.sort().map((t) => ({ id: t, label: t }));
};

/** Time-of-day picker (24h): choose from a list of times, bound to an "HH:MM" string. */
export const TimeOfDayField: FC<TimeOfDayFieldProps> = ({
    value,
    onChange,
    label,
    isRequired,
    isDisabled,
    stepMinutes = 15,
    className,
    "aria-label": ariaLabel,
}) => {
    const options = useMemo(() => timeOptions(stepMinutes, value), [stepMinutes, value]);
    return (
        <div className={cn("flex w-full flex-col gap-1.5", className)}>
            {label ? (
                <Label>
                    {label}
                    {isRequired ? <span className="text-danger"> *</span> : null}
                </Label>
            ) : null}
            <OptionSelect
                aria-label={ariaLabel ?? label ?? "Time"}
                options={options}
                value={value}
                onChange={(next) => {
                    if (next) onChange(next);
                }}
                isDisabled={isDisabled}
                placeholder="Select time"
            />
        </div>
    );
};
