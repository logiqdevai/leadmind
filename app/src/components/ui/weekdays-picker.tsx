import { Button, Checkbox, Label } from "@heroui/react";

/** ISO weekdays: 1 = Monday ... 7 = Sunday (matches the API). */
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
export const BUSINESS_WEEKDAYS = [1, 2, 3, 4, 5];

const DAY_LABELS: Record<number, string> = {
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
    7: "Sun",
};

export function sameWeekdays(a: number[], b: number[]): boolean {
    return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

interface WeekdaysPickerProps {
    value: number[];
    onChange: (value: number[]) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
}

export function WeekdaysPicker({
    value,
    onChange,
    label = "Allowed days",
    description,
    disabled = false,
}: WeekdaysPickerProps) {
    const toggle = (day: number, checked: boolean) => {
        const next = checked ? [...value, day] : value.filter((d) => d !== day);
        onChange([...new Set(next)].sort((a, b) => a - b));
    };

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>{label}</Label>
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant={sameWeekdays(value, BUSINESS_WEEKDAYS) ? "secondary" : "tertiary"}
                        onPress={() => onChange(BUSINESS_WEEKDAYS)}
                        isDisabled={disabled}
                    >
                        Weekdays (Mon–Fri)
                    </Button>
                    <Button
                        size="sm"
                        variant={sameWeekdays(value, ALL_WEEKDAYS) ? "secondary" : "tertiary"}
                        onPress={() => onChange(ALL_WEEKDAYS)}
                        isDisabled={disabled}
                    >
                        Every day
                    </Button>
                </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {ALL_WEEKDAYS.map((day) => (
                    <Checkbox
                        key={day}
                        isSelected={value.includes(day)}
                        onChange={(checked: boolean) => toggle(day, checked)}
                        isDisabled={disabled}
                    >
                        <Checkbox.Control>
                            <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="text-sm text-foreground">{DAY_LABELS[day]}</span>
                    </Checkbox>
                ))}
            </div>
            {value.length === 0 ? (
                <p className="text-xs text-danger">Select at least one day.</p>
            ) : description ? (
                <p className="text-xs text-muted">{description}</p>
            ) : null}
        </div>
    );
}
