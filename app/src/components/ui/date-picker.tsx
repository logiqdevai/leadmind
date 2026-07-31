import { Calendar, DateField, DatePicker, Label } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { cn } from "@/lib/utils";

function toDateValue(value: string | null | undefined): DateValue | null {
    if (!value) return null;
    try {
        return parseDate(value.slice(0, 10));
    } catch {
        return null;
    }
}

export interface AppDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    name?: string;
    className?: string;
    isDisabled?: boolean;
    minValue?: string;
    maxValue?: string;
    "aria-label"?: string;
}

export function AppDatePicker({
    value,
    onChange,
    label,
    name,
    className,
    isDisabled,
    minValue,
    maxValue,
    "aria-label": ariaLabel,
}: AppDatePickerProps) {
    return (
        <DatePicker
            name={name}
            className={cn("w-full", className)}
            value={toDateValue(value)}
            minValue={toDateValue(minValue) ?? undefined}
            maxValue={toDateValue(maxValue) ?? undefined}
            isDisabled={isDisabled}
            aria-label={ariaLabel ?? label}
            onChange={(next) => onChange(next ? next.toString() : "")}
        >
            {label ? <Label>{label}</Label> : null}
            <DateField.Group fullWidth>
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix>
                    <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover>
                <Calendar aria-label={ariaLabel ?? label ?? "Choose date"}>
                    <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                        <Calendar.GridHeader>
                            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                        </Calendar.GridHeader>
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
}
