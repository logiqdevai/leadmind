import { DateTime } from 'luxon';

/** "HH:MM" wall-clock interval inside one day; end may be "24:00". */
export interface TimeRange {
    start: string;
    end: string;
}

/** ISO weekday ("1"=Mon .. "7"=Sun) -> working periods. Missing/empty day = not working. */
export type WeeklyHours = Record<string, TimeRange[]>;

export interface Interval {
    start: Date;
    end: Date;
}

export interface SlotRules {
    booking_page_uuid: string;
    duration_minutes: number;
    slot_interval_minutes: number;
    min_notice_minutes: number;
    max_advance_days: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    min_gap_minutes: number;
    max_gap_minutes: number | null;
    max_bookings_per_day: number | null;
    seats_per_slot: number;
}

export interface ExistingBooking extends Interval {
    booking_page_uuid: string | null;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
}

export interface MemberAvailability {
    user_uuid: string;
    timezone: string;
    weekly_hours: WeeklyHours;
    /** "YYYY-MM-DD" (in member timezone) -> replacement periods; [] = day off. */
    overrides: Record<string, TimeRange[]>;
    /** Blocks, holidays and external calendar busy time. */
    busy: Interval[];
    /** Active bookings of this member on any page. */
    bookings: ExistingBooking[];
}

export interface MemberSlot extends Interval {
    seats_left: number;
    /** False only for candidates returned with `include_unavailable` (booked, blocked, inside the notice window...). */
    available: boolean;
}

export interface CombinedSlot extends Interval {
    /** Bookable with at least one member. Always true unless unavailable slots were requested. */
    available: boolean;
    /** Members free at this slot (internal only - never exposed on public pages unless member choice is enabled). */
    user_uuids: string[];
}

const MINUTE = 60_000;

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
    '1': [{ start: '09:00', end: '17:00' }],
    '2': [{ start: '09:00', end: '17:00' }],
    '3': [{ start: '09:00', end: '17:00' }],
    '4': [{ start: '09:00', end: '17:00' }],
    '5': [{ start: '09:00', end: '17:00' }],
    '6': [],
    '7': [],
};

export function parseTimeToMinutes(value: string): number {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
}

/** Resolve a local wall-clock time to an instant. Times inside a DST gap move forward (luxon semantics). */
function localToInstant(date: string, minutes: number, zone: string): DateTime {
    return DateTime.fromISO(date, { zone }).startOf('day').plus({ minutes });
}

/** Working intervals (as instants) of one local date, honouring date overrides over weekly hours. */
export function workingIntervalsForDate(member: Pick<MemberAvailability, 'timezone' | 'weekly_hours' | 'overrides'>, date: string): Interval[] {
    const day = DateTime.fromISO(date, { zone: member.timezone });
    const ranges = member.overrides[date] ?? member.weekly_hours[String(day.weekday)] ?? [];
    return ranges
        .map((r) => ({ startMin: parseTimeToMinutes(r.start), endMin: parseTimeToMinutes(r.end) }))
        .filter((r) => r.endMin > r.startMin)
        .map((r) => ({
            start: localToInstant(date, r.startMin, member.timezone).toJSDate(),
            end: localToInstant(date, r.endMin, member.timezone).toJSDate(),
        }));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && aEnd > bStart;
}

function localDate(instant: Date, zone: string): string {
    return DateTime.fromJSDate(instant, { zone }).toISODate()!;
}

/** Check one concrete slot for one member. Returns remaining seats, or 0 when not bookable. */
export function seatsLeftForSlot(
    rules: SlotRules,
    member: MemberAvailability,
    slot: Interval,
    options: { ignore_working_hours?: boolean } = {},
): number {
    const start = slot.start.getTime();
    const end = slot.end.getTime();

    if (!options.ignore_working_hours) {
        const date = localDate(slot.start, member.timezone);
        const inWorkingHours = workingIntervalsForDate(member, date).some(
            (w) => start >= w.start.getTime() && end <= w.end.getTime(),
        );
        if (!inWorkingHours) return 0;
    }

    const paddedStart = start - rules.buffer_before_minutes * MINUTE;
    const paddedEnd = end + rules.buffer_after_minutes * MINUTE;
    if (member.busy.some((b) => overlaps(paddedStart, paddedEnd, b.start.getTime(), b.end.getTime()))) return 0;

    const gap = rules.min_gap_minutes * MINUTE;
    let seatsTaken = 0;
    for (const b of member.bookings) {
        const bStart = b.start.getTime();
        const bEnd = b.end.getTime();
        const isSameGroupSlot =
            rules.seats_per_slot > 1 && b.booking_page_uuid === rules.booking_page_uuid && bStart === start && bEnd === end;
        if (isSameGroupSlot) {
            seatsTaken += 1;
            continue;
        }
        const bPaddedStart = bStart - b.buffer_before_minutes * MINUTE;
        const bPaddedEnd = bEnd + b.buffer_after_minutes * MINUTE;
        if (overlaps(paddedStart - gap, paddedEnd + gap, bPaddedStart, bPaddedEnd)) return 0;
    }
    const seatsLeft = rules.seats_per_slot - seatsTaken;
    if (seatsLeft <= 0) return 0;

    const date = localDate(slot.start, member.timezone);
    const sameDay = member.bookings.filter((b) => localDate(b.start, member.timezone) === date);

    if (rules.max_bookings_per_day != null) {
        // Seats in a slot that is already counted don't consume another daily booking.
        const pageBookingsThatDay = sameDay.filter(
            (b) => b.booking_page_uuid === rules.booking_page_uuid && !(b.start.getTime() === start && b.end.getTime() === end),
        );
        const distinctStarts = new Set(pageBookingsThatDay.map((b) => b.start.getTime()));
        if (distinctStarts.size >= rules.max_bookings_per_day && seatsTaken === 0) return 0;
    }

    if (rules.max_gap_minutes != null && sameDay.length > 0 && seatsTaken === 0) {
        const maxGap = rules.max_gap_minutes * MINUTE;
        const nearEnough = sameDay.some((b) => {
            const before = start - b.end.getTime();
            const after = b.start.getTime() - end;
            return (before >= 0 && before <= maxGap) || (after >= 0 && after <= maxGap);
        });
        if (!nearEnough) return 0;
    }

    return seatsLeft;
}

/**
 * Start times of one member in [from, to). By default only bookable ones; with `include_unavailable`
 * every upcoming start time inside working hours is returned and flagged `available: false` when it
 * can't be booked (already booked, blocked, within a buffer/gap, inside the notice window, day full).
 */
export function computeMemberSlots(
    rules: SlotRules,
    member: MemberAvailability,
    range: Interval,
    now: Date,
    options: { include_unavailable?: boolean } = {},
): MemberSlot[] {
    const noticeEarliest = Math.max(range.start.getTime(), now.getTime() + rules.min_notice_minutes * MINUTE);
    // Times that already started are never listed; times inside the notice window may be (disabled).
    const earliest = options.include_unavailable ? Math.max(range.start.getTime(), now.getTime()) : noticeEarliest;
    const latest = Math.min(range.end.getTime(), now.getTime() + rules.max_advance_days * 24 * 60 * MINUTE);
    if (earliest >= latest) return [];

    const duration = rules.duration_minutes * MINUTE;
    const step = Math.max(5, rules.slot_interval_minutes) * MINUTE;
    const slots: MemberSlot[] = [];

    // Pad by a day either side: a local date can start before/after the UTC range boundary.
    let day = DateTime.fromMillis(earliest, { zone: member.timezone }).startOf('day').minus({ days: 1 });
    const lastDay = DateTime.fromMillis(latest, { zone: member.timezone }).startOf('day').plus({ days: 1 });

    while (day <= lastDay) {
        const date = day.toISODate()!;
        for (const window of workingIntervalsForDate(member, date)) {
            for (let s = window.start.getTime(); s + duration <= window.end.getTime(); s += step) {
                if (s < earliest || s >= latest) continue;
                const slot = { start: new Date(s), end: new Date(s + duration) };
                const seats_left = seatsLeftForSlot(rules, member, slot, { ignore_working_hours: true });
                const available = seats_left > 0 && s >= noticeEarliest;
                if (available || options.include_unavailable) slots.push({ ...slot, seats_left, available });
            }
        }
        day = day.plus({ days: 1 });
    }
    return slots;
}

/** Union of member slots: a start time is available when at least one eligible member is free. */
export function combineMemberSlots(perMember: { user_uuid: string; slots: MemberSlot[] }[]): CombinedSlot[] {
    const byStart = new Map<number, CombinedSlot>();
    for (const { user_uuid, slots } of perMember) {
        for (const slot of slots) {
            const key = slot.start.getTime();
            const existing = byStart.get(key);
            const free = slot.available ? [user_uuid] : [];
            if (existing) {
                existing.user_uuids.push(...free);
                existing.available ||= slot.available;
            } else {
                byStart.set(key, { start: slot.start, end: slot.end, available: slot.available, user_uuids: free });
            }
        }
    }
    return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function isValidTimeZone(zone: string): boolean {
    return DateTime.local().setZone(zone).isValid;
}
