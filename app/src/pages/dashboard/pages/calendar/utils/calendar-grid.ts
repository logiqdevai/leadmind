import { addDays, isoWeekday, zonedTimeToIso } from "@/features/bookings/utils/booking-time";
import { minutesOfDayInZone } from "@/components/bookings/utils/booking-display";

export const CalendarViews = {
    MONTH: "month",
    WEEK: "week",
    DAY: "day",
    LIST: "list",
} as const;
export type CalendarView = (typeof CalendarViews)[keyof typeof CalendarViews];

export const ListScopes = {
    UPCOMING: "upcoming",
    PAST: "past",
} as const;
export type ListScope = (typeof ListScopes)[keyof typeof ListScopes];

/** Pixel height of one hour row in week/day views. */
export const HOUR_HEIGHT = 48;
/** Click-to-create snaps to this many minutes. */
export const SLOT_SNAP_MINUTES = 30;
export const MINUTES_PER_DAY = 1440;

const pad = (n: number) => String(n).padStart(2, "0");

export const isDateKey = (value: string | null | undefined): value is string =>
    !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const minutesToTimeKey = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export function startOfWeek(dateKey: string): string {
    return addDays(dateKey, -(isoWeekday(dateKey) - 1));
}

function monthParts(dateKey: string): { year: number; month: number } {
    const [y, m] = dateKey.split("-").map(Number);
    return { year: y, month: m };
}

function firstOfMonth(year: number, month: number): string {
    const d = new Date(Date.UTC(year, month - 1, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

function lastOfMonth(year: number, month: number): string {
    const d = new Date(Date.UTC(year, month, 0));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export const isSameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** Local day keys rendered by a view (month grids span whole weeks). */
export function visibleDays(view: CalendarView, anchor: string): string[] {
    let start: string;
    let count: number;
    if (view === CalendarViews.DAY) {
        start = anchor;
        count = 1;
    } else if (view === CalendarViews.WEEK) {
        start = startOfWeek(anchor);
        count = 7;
    } else {
        const { year, month } = monthParts(anchor);
        start = startOfWeek(firstOfMonth(year, month));
        const end = addDays(startOfWeek(lastOfMonth(year, month)), 6);
        count = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
    }
    return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Days of the anchor's month only (agenda on mobile). */
export function monthDays(anchor: string): { first: string; last: string } {
    const { year, month } = monthParts(anchor);
    return { first: firstOfMonth(year, month), last: lastOfMonth(year, month) };
}

export function shiftAnchor(view: CalendarView, anchor: string, direction: 1 | -1): string {
    if (view === CalendarViews.DAY) return addDays(anchor, direction);
    if (view === CalendarViews.WEEK) return addDays(anchor, 7 * direction);
    const { year, month } = monthParts(anchor);
    return firstOfMonth(year, month + direction);
}

const utcDate = (dateKey: string) => {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
};

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, { timeZone: "UTC", ...options });

export function rangeLabel(view: CalendarView, anchor: string): string {
    if (view === CalendarViews.MONTH) return fmt({ month: "long", year: "numeric" }).format(utcDate(anchor));
    if (view === CalendarViews.DAY) {
        return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(utcDate(anchor));
    }
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    const sameMonth = isSameMonth(start, end);
    const startLabel = fmt(sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }).format(utcDate(start));
    const endLabel = fmt({ day: "numeric", month: "short", year: "numeric" }).format(utcDate(end));
    return `${startLabel} – ${endLabel}`;
}

export const weekdayShort = (dateKey: string) => fmt({ weekday: "short" }).format(utcDate(dateKey));
export const dayOfMonth = (dateKey: string) => Number(dateKey.slice(8, 10));
export const shortDayLabel = (dateKey: string) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(utcDate(dateKey));

export interface TimedItem {
    start_at: string;
    end_at: string;
}

export interface DaySegment<T> {
    item: T;
    /** Minutes from local midnight. */
    startMinute: number;
    endMinute: number;
    /** Starts before / ends after this day. */
    continuesBefore: boolean;
    continuesAfter: boolean;
}

/** Part of each item that falls on local day `dayKey` in `timeZone`. */
export function segmentsForDay<T extends TimedItem>(items: T[], dayKey: string, timeZone: string): DaySegment<T>[] {
    const dayStart = Date.parse(zonedTimeToIso(dayKey, "00:00", timeZone));
    const dayEnd = Date.parse(zonedTimeToIso(addDays(dayKey, 1), "00:00", timeZone));
    const result: DaySegment<T>[] = [];
    for (const item of items) {
        const start = Date.parse(item.start_at);
        const end = Date.parse(item.end_at);
        if (!(start < dayEnd && end > dayStart)) continue;
        const continuesBefore = start < dayStart;
        const continuesAfter = end > dayEnd;
        const startMinute = continuesBefore ? 0 : minutesOfDayInZone(item.start_at, timeZone);
        let endMinute = continuesAfter || end === dayEnd ? MINUTES_PER_DAY : minutesOfDayInZone(item.end_at, timeZone);
        if (endMinute <= startMinute) endMinute = Math.min(MINUTES_PER_DAY, startMinute + 15);
        result.push({ item, startMinute, endMinute, continuesBefore, continuesAfter });
    }
    return result.sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
}

export interface PositionedSegment<T> extends DaySegment<T> {
    column: number;
    columns: number;
}

/** Side-by-side columns for overlapping segments (greedy, per overlap cluster). */
export function layoutSegments<T>(segments: DaySegment<T>[]): PositionedSegment<T>[] {
    const result: PositionedSegment<T>[] = [];
    let cluster: PositionedSegment<T>[] = [];
    let columnEnds: number[] = [];
    let clusterEnd = -1;

    const flush = () => {
        const columns = Math.max(1, columnEnds.length);
        for (const s of cluster) s.columns = columns;
        result.push(...cluster);
        cluster = [];
        columnEnds = [];
    };

    for (const seg of segments) {
        if (seg.startMinute >= clusterEnd && cluster.length) flush();
        let column = columnEnds.findIndex((end) => end <= seg.startMinute);
        if (column === -1) {
            column = columnEnds.length;
            columnEnds.push(seg.endMinute);
        } else {
            columnEnds[column] = seg.endMinute;
        }
        cluster.push({ ...seg, column, columns: 1 });
        clusterEnd = Math.max(clusterEnd, seg.endMinute);
    }
    if (cluster.length) flush();
    return result;
}
