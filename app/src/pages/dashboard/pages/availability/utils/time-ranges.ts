import type { TimeRange, WeeklyHours } from "@/features/bookings/interfaces/bookings.interfaces";

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const WEEKDAY_LABELS: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
};

export const DEFAULT_PERIOD: TimeRange = { start: "09:00", end: "17:00" };

/** "HH:MM" -> minutes since midnight ("24:00" = 1440). */
export function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

/** First problem in a day's periods, or null when they are valid. */
export function periodsError(periods: TimeRange[]): string | null {
    for (const p of periods) {
        if (!p.start || !p.end) return "Enter a start and end time";
        if (timeToMinutes(p.start) >= timeToMinutes(p.end)) return "Each period must end after it starts";
    }
    const sorted = [...periods].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (let i = 1; i < sorted.length; i += 1) {
        if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) return "Periods overlap";
    }
    return null;
}

export const sortPeriods = (periods: TimeRange[]): TimeRange[] =>
    [...periods].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

export interface DayHours {
    day: number;
    enabled: boolean;
    periods: TimeRange[];
}

export function weeklyHoursToDays(weekly: WeeklyHours): DayHours[] {
    return ISO_WEEKDAYS.map((day) => {
        const periods = weekly[String(day)] ?? [];
        return { day, enabled: periods.length > 0, periods: periods.length ? sortPeriods(periods) : [{ ...DEFAULT_PERIOD }] };
    });
}

export function daysToWeeklyHours(days: DayHours[]): WeeklyHours {
    const result: WeeklyHours = {};
    for (const d of days) result[String(d.day)] = d.enabled ? sortPeriods(d.periods) : [];
    return result;
}

export const formatPeriods = (periods: TimeRange[]): string =>
    sortPeriods(periods)
        .map((p) => `${p.start}–${p.end}`)
        .join(", ");
