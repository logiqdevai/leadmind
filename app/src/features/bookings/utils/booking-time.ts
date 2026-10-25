import { CalendarDateTime, toZoned } from "@internationalized/date";

/**
 * Booking times are UTC instants from the API; they are always displayed in an explicit IANA
 * timezone (the visitor's, the member's or the organisation's) - never implicitly in the browser's.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of an instant as seen in `timeZone`. */
export function dateKeyInZone(instant: string | Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(instant));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Instant of a wall-clock date + "HH:MM" in `timeZone` (DST-safe; gaps resolve forward). */
export function zonedTimeToIso(date: string, time: string, timeZone: string): string {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    return toZoned(new CalendarDateTime(y, m, d, hh, mm), timeZone, "later").toDate().toISOString();
}

/** UTC range covering whole local days [startDate, endDate] in `timeZone`. */
export function zonedDayRange(startDate: string, endDate: string, timeZone: string): { from: string; to: string } {
    return { from: zonedTimeToIso(startDate, "00:00", timeZone), to: zonedTimeToIso(addDays(endDate, 1), "00:00", timeZone) };
}

/** Calendar arithmetic on "YYYY-MM-DD" keys (timezone independent). */
export function addDays(date: string, days: number): string {
    const [y, m, d] = date.split("-").map(Number);
    const value = new Date(Date.UTC(y, m - 1, d + days));
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

/** ISO weekday (1=Mon..7=Sun) of a "YYYY-MM-DD" key. */
export function isoWeekday(date: string): number {
    const [y, m, d] = date.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return day === 0 ? 7 : day;
}

export function formatTime(instant: string | Date, timeZone: string): string {
    return new Intl.DateTimeFormat(undefined, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(instant));
}

export function formatTimeRange(start: string | Date, end: string | Date, timeZone: string): string {
    return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`;
}

export function formatDateLong(instant: string | Date, timeZone: string): string {
    return new Intl.DateTimeFormat(undefined, {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(instant));
}

export function formatDateShort(instant: string | Date, timeZone: string): string {
    return new Intl.DateTimeFormat(undefined, { timeZone, weekday: "short", day: "numeric", month: "short" }).format(
        new Date(instant),
    );
}

export function formatDateTime(instant: string | Date, timeZone: string): string {
    return `${formatDateShort(instant, timeZone)}, ${formatTime(instant, timeZone)}`;
}

/** Long label for a "YYYY-MM-DD" key, e.g. "Monday, 2 November 2026". */
export function formatDateKey(date: string): string {
    const [y, m, d] = date.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, {
        timeZone: "UTC",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "30 min", "1 h", "1 h 30 min". */
export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "1 day", "2 hours", "30 minutes" - for notice periods and reminder offsets. */
export function formatMinutesSpan(minutes: number): string {
    if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
    if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
    return `${minutes} minutes`;
}

/** Timezone offset label, e.g. "GMT+2", for showing next to times. */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
}
