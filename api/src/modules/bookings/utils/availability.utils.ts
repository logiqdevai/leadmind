import { parseTimeToMinutes, TimeRange, WeeklyHours } from './slot-calculation.util';

const TIME_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'];

/**
 * Validates and sorts one day's periods. Returns an error message instead of throwing so callers
 * can report which day is wrong.
 */
export function normalizeTimeRanges(ranges: unknown): { ranges: TimeRange[]; error?: string } {
    if (!Array.isArray(ranges)) return { ranges: [], error: 'must be a list of { start, end } periods' };
    const parsed: TimeRange[] = [];
    for (const range of ranges) {
        const start = (range as TimeRange)?.start;
        const end = (range as TimeRange)?.end;
        if (!TIME_PATTERN.test(start ?? '') || !TIME_PATTERN.test(end ?? '')) {
            return { ranges: [], error: 'times must be HH:MM' };
        }
        if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) {
            return { ranges: [], error: `period ${start}-${end} must end after it starts` };
        }
        parsed.push({ start, end });
    }
    parsed.sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
    for (let i = 1; i < parsed.length; i++) {
        if (parseTimeToMinutes(parsed[i].start) < parseTimeToMinutes(parsed[i - 1].end)) {
            return { ranges: [], error: `periods ${parsed[i - 1].start}-${parsed[i - 1].end} and ${parsed[i].start}-${parsed[i].end} overlap` };
        }
    }
    return { ranges: parsed };
}

export function normalizeWeeklyHours(input: Record<string, unknown>): { weekly_hours: WeeklyHours; error?: string } {
    const weekly_hours: WeeklyHours = {};
    for (const key of Object.keys(input)) {
        if (!WEEKDAYS.includes(key)) return { weekly_hours, error: `"${key}" is not an ISO weekday (1-7)` };
    }
    for (const day of WEEKDAYS) {
        const { ranges, error } = normalizeTimeRanges(input[day] ?? []);
        if (error) return { weekly_hours, error: `weekday ${day}: ${error}` };
        weekly_hours[day] = ranges;
    }
    return { weekly_hours };
}
