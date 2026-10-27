import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
import type { PrismaService } from '@/core/databases/prisma/prisma.service';

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface OpeningInterval {
    /** "HH:MM", 24-hour */
    open: string;
    /** "HH:MM", 24-hour; "24:00" means midnight at the end of the day. Earlier than `open` = closes after midnight. */
    close: string;
}

/** Opening intervals per weekday; an empty array means closed that day. */
export type OpeningHours = Record<Weekday, OpeningInterval[]>;

export interface OpeningHourRow {
    day_of_week: number;
    opens_minute: number;
    closes_minute: number;
}

const MAX_INTERVALS_PER_DAY = 4;
const MINUTES_PER_DAY = 1440;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

export function timeToMinutes(time: string): number | null {
    const match = TIME_PATTERN.exec(time.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes > 59) return null;
    if (hours === 24 && minutes === 0) return MINUTES_PER_DAY;
    if (hours > 23) return null;
    return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
    if (totalMinutes === MINUTES_PER_DAY) return '24:00';
    const wrapped = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export function emptyOpeningHours(): OpeningHours {
    return Object.fromEntries(WEEKDAYS.map((day) => [day, [] as OpeningInterval[]])) as OpeningHours;
}

/**
 * Validates and canonicalises user-supplied hours. Returns null when there is nothing to store
 * (null/empty input, or every day closed) so callers can treat that as "no opening hours known".
 */
export function normalizeOpeningHours(input: unknown): OpeningHours | null {
    if (input === null || input === undefined) return null;
    if (typeof input !== 'object' || Array.isArray(input)) {
        throw new BadRequestException('opening_hours must be an object keyed by weekday');
    }

    const result = emptyOpeningHours();
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        const day = key.toLowerCase() as Weekday;
        if (!WEEKDAYS.includes(day)) {
            throw new BadRequestException(`Unknown weekday "${key}" in opening_hours`);
        }
        if (value === null || value === undefined) continue;
        if (!Array.isArray(value)) {
            throw new BadRequestException(`opening_hours.${day} must be an array of { open, close } intervals`);
        }
        if (value.length > MAX_INTERVALS_PER_DAY) {
            throw new BadRequestException(`opening_hours.${day} can have at most ${MAX_INTERVALS_PER_DAY} intervals`);
        }
        const intervals: { open: number; close: number }[] = [];
        for (const item of value) {
            const open = typeof item?.open === 'string' ? timeToMinutes(item.open) : null;
            const close = typeof item?.close === 'string' ? timeToMinutes(item.close) : null;
            if (open === null || close === null || open >= MINUTES_PER_DAY) {
                throw new BadRequestException(`opening_hours.${day} intervals need "open" and "close" as HH:MM`);
            }
            if (open === close) {
                throw new BadRequestException(`opening_hours.${day}: open and close can't be the same time`);
            }
            intervals.push({ open, close });
        }
        intervals.sort((a, b) => a.open - b.open);
        result[day] = intervals.map((i) => ({ open: minutesToTime(i.open), close: minutesToTime(i.close) }));
    }

    return WEEKDAYS.every((day) => result[day].length === 0) ? null : result;
}

export function openingHoursToRows(hours: OpeningHours): OpeningHourRow[] {
    const rows: OpeningHourRow[] = [];
    WEEKDAYS.forEach((day, day_of_week) => {
        for (const interval of hours[day]) {
            const opens_minute = timeToMinutes(interval.open)!;
            let closes_minute = timeToMinutes(interval.close)!;
            if (closes_minute <= opens_minute) closes_minute += MINUTES_PER_DAY;
            rows.push({ day_of_week, opens_minute, closes_minute });
        }
    });
    return rows;
}

export function openingHoursFromRows(rows: OpeningHourRow[]): OpeningHours | null {
    if (rows.length === 0) return null;
    const hours = emptyOpeningHours();
    const sorted = [...rows].sort((a, b) => a.day_of_week - b.day_of_week || a.opens_minute - b.opens_minute);
    for (const row of sorted) {
        const day = WEEKDAYS[row.day_of_week];
        if (!day) continue;
        hours[day].push({ open: minutesToTime(row.opens_minute), close: minutesToTime(row.closes_minute) });
    }
    return hours;
}

/** JSON column value (e.g. Lead.opening_hours) to validated hours; bad data is treated as "no hours". */
export function openingHoursFromJson(value: Prisma.JsonValue | null | undefined): OpeningHours | null {
    try {
        return normalizeOpeningHours(value);
    } catch {
        return null;
    }
}

const DAY_ALIASES: Record<string, Weekday> = {
    monday: 'monday', mon: 'monday',
    tuesday: 'tuesday', tue: 'tuesday', tues: 'tuesday',
    wednesday: 'wednesday', wed: 'wednesday',
    thursday: 'thursday', thu: 'thursday', thur: 'thursday', thurs: 'thursday',
    friday: 'friday', fri: 'friday',
    saturday: 'saturday', sat: 'saturday',
    sunday: 'sunday', sun: 'sunday',
};

const RANGE_PATTERN =
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|until|till|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;

function clockToMinutes(hour: number, minute: number, meridiem: 'am' | 'pm' | undefined): number | null {
    if (minute > 59) return null;
    if (!meridiem) return hour <= 24 ? hour * 60 + minute : null;
    if (hour < 1 || hour > 12) return null;
    return ((hour % 12) + (meridiem === 'pm' ? 12 : 0)) * 60 + minute;
}

function parseSegment(segment: string): { open: number; close: number } | null {
    const match = RANGE_PATTERN.exec(segment.trim());
    if (!match) return null;
    const [, h1, m1, mer1, h2, m2, mer2] = match;
    const endMeridiem = mer2?.toLowerCase() as 'am' | 'pm' | undefined;
    let startMeridiem = (mer1?.toLowerCase() as 'am' | 'pm' | undefined) ?? endMeridiem;

    const close = clockToMinutes(Number(h2), Number(m2 ?? 0), endMeridiem);
    let open = clockToMinutes(Number(h1), Number(m1 ?? 0), startMeridiem);
    if (open === null || close === null) return null;

    // "9 to 5 PM": the start only inherits PM when that still leaves it before the end.
    if (!mer1 && endMeridiem && open >= close) {
        startMeridiem = endMeridiem === 'pm' ? 'am' : 'pm';
        open = clockToMinutes(Number(h1), Number(m1 ?? 0), startMeridiem);
        if (open === null) return null;
    }
    if (open === close) return null;
    return { open, close };
}

/** Parses one day's Google Maps text, e.g. "9 AM to 5 PM", "9 AM to 12 PM, 2 to 6 PM", "Closed", "Open 24 hours". */
export function parseHoursText(text: string): OpeningInterval[] | null {
    const clean = text.replace(/[   ]/g, ' ').trim();
    if (!clean) return null;
    if (/^closed$/i.test(clean)) return [];
    if (/open\s*24\s*hours/i.test(clean)) return [{ open: '00:00', close: '24:00' }];

    const intervals: OpeningInterval[] = [];
    for (const segment of clean.split(/\s*,\s*|\s*&\s*/)) {
        const parsed = parseSegment(segment);
        if (!parsed) return null;
        intervals.push({ open: minutesToTime(parsed.open), close: minutesToTime(parsed.close) });
    }
    return intervals;
}

/**
 * Google Maps scraper output: [{ day: "Monday", hours: "9 AM to 5 PM" }, ...]. Days that can't be
 * parsed are left closed; returns null when nothing usable was found.
 */
export function parseGoogleMapsOpeningHours(raw: unknown): OpeningHours | null {
    if (!Array.isArray(raw)) return null;
    const hours = emptyOpeningHours();
    let parsedAny = false;
    for (const entry of raw) {
        const day = typeof entry?.day === 'string' ? DAY_ALIASES[entry.day.trim().toLowerCase()] : undefined;
        const intervals = typeof entry?.hours === 'string' ? parseHoursText(entry.hours) : null;
        if (!day || !intervals) continue;
        hours[day] = intervals.slice(0, MAX_INTERVALS_PER_DAY);
        parsedAny = true;
    }
    return parsedAny && WEEKDAYS.some((day) => hours[day].length > 0) ? hours : null;
}

export interface OpeningHoursFilter {
    open_day?: Weekday;
    /** "HH:MM" start of the range the business must be open through */
    open_from?: string;
    /** "HH:MM" end of the range */
    open_to?: string;
}

/**
 * Contacts that are open for the whole of [open_from, open_to] (on open_day, or on any day).
 * With only one bound the contact must be open at that moment; with only a day, open at all that day.
 */
export function buildOpeningHoursWhere(filter: OpeningHoursFilter): Prisma.ContactWhereInput | null {
    const { open_day, open_from, open_to } = filter;
    if (!open_day && !open_from && !open_to) return null;

    const day = open_day ? WEEKDAYS.indexOf(open_day) : undefined;
    if (!open_from && !open_to) {
        return { opening_hours_rows: { some: { day_of_week: day } } };
    }

    const from = timeToMinutes((open_from ?? open_to)!) ?? 0;
    let to = timeToMinutes((open_to ?? open_from)!) ?? from;
    if (to < from) to += MINUTES_PER_DAY;

    const sameDay: Prisma.ContactOpeningHourWhereInput = {
        ...(day !== undefined && { day_of_week: day }),
        opens_minute: { lte: from },
        closes_minute: { gte: to },
    };
    // The previous day's interval may run past midnight and cover the early hours of this day.
    const spillover: Prisma.ContactOpeningHourWhereInput = {
        ...(day !== undefined && { day_of_week: (day + 6) % 7 }),
        closes_minute: { gte: to + MINUTES_PER_DAY },
    };
    return { opening_hours_rows: { some: { OR: [sameDay, spillover] } } };
}

/** Replaces a contact's stored hours; null clears them. */
export async function replaceContactOpeningHours(
    prisma: Pick<PrismaService, 'contactOpeningHour' | '$transaction'>,
    contact_uuid: string,
    hours: OpeningHours | null,
): Promise<void> {
    const rows = hours ? openingHoursToRows(hours) : [];
    await prisma.$transaction([
        prisma.contactOpeningHour.deleteMany({ where: { contact_uuid } }),
        ...(rows.length
            ? [prisma.contactOpeningHour.createMany({ data: rows.map((row) => ({ ...row, contact_uuid })) })]
            : []),
    ]);
}

/** Copies hours onto a contact only when it has none yet, so a re-scrape never overwrites hours a member edited. */
export async function fillContactOpeningHoursIfEmpty(
    prisma: Pick<PrismaService, 'contactOpeningHour' | '$transaction'>,
    contact_uuid: string,
    hours: OpeningHours | null,
): Promise<void> {
    if (!hours) return;
    const existing = await prisma.contactOpeningHour.count({ where: { contact_uuid } });
    if (existing === 0) await replaceContactOpeningHours(prisma, contact_uuid, hours);
}
