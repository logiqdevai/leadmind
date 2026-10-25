import { DateTime } from 'luxon';

/** ISO weekdays: 1 = Monday ... 7 = Sunday (matches luxon's `weekday`). */
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export function normalizeWeekdays(weekdays: number[]): number[] {
    return [...new Set(weekdays)].sort((a, b) => a - b);
}

/** Null/empty means "no restriction", so legacy rows and bad data never block sending entirely. */
export function isRestricted(allowed?: number[] | null): allowed is number[] {
    return !!allowed?.length && allowed.length < ALL_WEEKDAYS.length;
}

export function isWeekdayAllowed(
    at: Date,
    timezone: string,
    allowed?: number[] | null,
): boolean {
    if (!isRestricted(allowed)) return true;
    return allowed.includes(DateTime.fromJSDate(at, { zone: timezone || 'UTC' }).weekday);
}

/**
 * Returns `at` unchanged if it falls on an allowed weekday (in `timezone`), otherwise
 * the same wall-clock time on the next allowed day. Adding calendar days (not 24h
 * blocks) keeps the local time stable across DST changes.
 */
export function shiftToAllowedWeekday(
    at: Date,
    timezone: string,
    allowed?: number[] | null,
): Date {
    if (!isRestricted(allowed)) return at;
    let dt = DateTime.fromJSDate(at, { zone: timezone || 'UTC' });
    for (let i = 0; i < 7 && !allowed.includes(dt.weekday); i++) {
        dt = dt.plus({ days: 1 });
    }
    return dt.toJSDate();
}
