export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
};

export interface OpeningInterval {
    /** "HH:MM", 24-hour */
    open: string;
    /** "HH:MM", 24-hour; earlier than `open` means it closes after midnight */
    close: string;
}

/** Intervals per weekday; an empty list means closed. */
export type OpeningHours = Record<Weekday, OpeningInterval[]>;

export const emptyOpeningHours = (): OpeningHours =>
    Object.fromEntries(WEEKDAYS.map((day) => [day, [] as OpeningInterval[]])) as OpeningHours;

export const DEFAULT_INTERVAL: OpeningInterval = { open: "09:00", close: "17:00" };

export const isWeekday = (value: string | null | undefined): value is Weekday =>
    !!value && (WEEKDAYS as readonly string[]).includes(value);

export function formatInterval(interval: OpeningInterval): string {
    return `${interval.open}–${interval.close === "24:00" ? "24:00" : interval.close}`;
}

export function formatDayHours(intervals: OpeningInterval[] | undefined): string {
    if (!intervals || intervals.length === 0) return "Closed";
    if (intervals.length === 1 && intervals[0].open === "00:00" && intervals[0].close === "24:00") return "Open 24 hours";
    return intervals.map(formatInterval).join(", ");
}

/** Every filled interval needs both times, and open and close can't be the same instant. */
export function validateOpeningHours(hours: OpeningHours): string | null {
    for (const day of WEEKDAYS) {
        for (const interval of hours[day]) {
            if (!interval.open || !interval.close) return `${WEEKDAY_LABELS[day]}: set both an opening and a closing time.`;
            if (interval.open === interval.close) return `${WEEKDAY_LABELS[day]}: opening and closing time can't be the same.`;
        }
    }
    return null;
}

export const hasAnyOpeningHours = (hours: OpeningHours | null | undefined): hours is OpeningHours =>
    !!hours && WEEKDAYS.some((day) => (hours[day] ?? []).length > 0);
