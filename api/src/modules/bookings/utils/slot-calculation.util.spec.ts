import {
    combineMemberSlots,
    computeMemberSlots,
    MemberAvailability,
    seatsLeftForSlot,
    SlotRules,
} from './slot-calculation.util';

const PAGE = 'page-1';

const rules = (overrides: Partial<SlotRules> = {}): SlotRules => ({
    booking_page_uuid: PAGE,
    duration_minutes: 30,
    slot_interval_minutes: 30,
    min_notice_minutes: 0,
    max_advance_days: 60,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_gap_minutes: 0,
    max_gap_minutes: null,
    max_bookings_per_day: null,
    seats_per_slot: 1,
    ...overrides,
});

const member = (overrides: Partial<MemberAvailability> = {}): MemberAvailability => ({
    user_uuid: 'u1',
    timezone: 'UTC',
    weekly_hours: { '1': [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '16:00' }] },
    overrides: {},
    busy: [],
    bookings: [],
    ...overrides,
});

// Monday 2026-11-02 (UTC) - well before the slots, so notice/advance limits don't interfere.
const NOW = new Date('2026-11-01T00:00:00Z');
const MONDAY = { start: new Date('2026-11-02T00:00:00Z'), end: new Date('2026-11-03T00:00:00Z') };
const times = (slots: { start: Date }[]) => slots.map((s) => s.start.toISOString().slice(11, 16));

describe('slot calculation', () => {
    it('offers slots inside each working period and skips the break', () => {
        const slots = computeMemberSlots(rules(), member(), MONDAY, NOW);
        expect(times(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30']);
    });

    it('uses the slot interval independently of the duration', () => {
        const slots = computeMemberSlots(rules({ duration_minutes: 60, slot_interval_minutes: 15 }), member(), MONDAY, NOW);
        expect(times(slots).slice(0, 3)).toEqual(['09:00', '09:15', '09:30']);
        expect(times(slots)).toContain('11:00');
        expect(times(slots)).not.toContain('11:15');
    });

    it('applies a date override, including a full day off', () => {
        const custom = computeMemberSlots(rules(), member({ overrides: { '2026-11-02': [{ start: '18:00', end: '19:00' }] } }), MONDAY, NOW);
        expect(times(custom)).toEqual(['18:00', '18:30']);
        const off = computeMemberSlots(rules(), member({ overrides: { '2026-11-02': [] } }), MONDAY, NOW);
        expect(off).toHaveLength(0);
    });

    it('respects minimum notice and maximum advance', () => {
        const now = new Date('2026-11-02T09:10:00Z');
        const slots = computeMemberSlots(rules({ min_notice_minutes: 60 }), member(), MONDAY, now);
        expect(times(slots)[0]).toBe('10:30');
        expect(computeMemberSlots(rules({ max_advance_days: 0 }), member(), MONDAY, NOW)).toHaveLength(0);
    });

    it('treats busy time (blocks, external events) and buffers as conflicts', () => {
        const busy = [{ start: new Date('2026-11-02T10:00:00Z'), end: new Date('2026-11-02T10:30:00Z') }];
        const plain = computeMemberSlots(rules(), member({ busy }), MONDAY, NOW);
        expect(times(plain)).not.toContain('10:00');
        expect(times(plain)).toContain('09:30');
        const buffered = computeMemberSlots(rules({ buffer_after_minutes: 15 }), member({ busy }), MONDAY, NOW);
        expect(times(buffered)).not.toContain('09:30');
    });

    it('prevents overlap with existing bookings including their buffers and the minimum gap', () => {
        const bookings = [
            {
                start: new Date('2026-11-02T10:00:00Z'),
                end: new Date('2026-11-02T10:30:00Z'),
                booking_page_uuid: 'other',
                buffer_before_minutes: 0,
                buffer_after_minutes: 30,
            },
        ];
        const slots = computeMemberSlots(rules(), member({ bookings }), MONDAY, NOW);
        expect(times(slots)).not.toContain('10:00');
        expect(times(slots)).not.toContain('10:30');
        expect(times(slots)).toContain('11:00');
        const gapped = computeMemberSlots(rules({ min_gap_minutes: 30 }), member({ bookings }), MONDAY, NOW);
        expect(times(gapped)).not.toContain('09:30');
        expect(times(gapped)).not.toContain('11:00');
    });

    it('fills group slots up to the seat capacity', () => {
        const booking = {
            start: new Date('2026-11-02T09:00:00Z'),
            end: new Date('2026-11-02T09:30:00Z'),
            booking_page_uuid: PAGE,
            buffer_before_minutes: 0,
            buffer_after_minutes: 0,
        };
        const slot = { start: booking.start, end: booking.end };
        expect(seatsLeftForSlot(rules({ seats_per_slot: 3 }), member({ bookings: [booking] }), slot)).toBe(2);
        expect(seatsLeftForSlot(rules({ seats_per_slot: 2 }), member({ bookings: [booking, booking] }), slot)).toBe(0);
        expect(seatsLeftForSlot(rules({ seats_per_slot: 1 }), member({ bookings: [booking] }), slot)).toBe(0);
    });

    it('caps bookings per day', () => {
        const booking = {
            start: new Date('2026-11-02T14:00:00Z'),
            end: new Date('2026-11-02T14:30:00Z'),
            booking_page_uuid: PAGE,
            buffer_before_minutes: 0,
            buffer_after_minutes: 0,
        };
        expect(computeMemberSlots(rules({ max_bookings_per_day: 1 }), member({ bookings: [booking] }), MONDAY, NOW)).toHaveLength(0);
        expect(computeMemberSlots(rules({ max_bookings_per_day: 2 }), member({ bookings: [booking] }), MONDAY, NOW).length).toBeGreaterThan(0);
    });

    it('keeps new bookings close to existing ones when a maximum gap is set', () => {
        const booking = {
            start: new Date('2026-11-02T10:00:00Z'),
            end: new Date('2026-11-02T10:30:00Z'),
            booking_page_uuid: PAGE,
            buffer_before_minutes: 0,
            buffer_after_minutes: 0,
        };
        const slots = computeMemberSlots(rules({ max_gap_minutes: 30 }), member({ bookings: [booking] }), MONDAY, NOW);
        expect(times(slots)).toEqual(['09:00', '09:30', '10:30', '11:00']);
    });

    it('interprets working hours in the member timezone across a DST change', () => {
        // US DST ends Sunday 2026-11-01; Monday 9:00 New York is 14:00 UTC (EST), the Friday before is 13:00 UTC (EDT).
        const ny = member({ timezone: 'America/New_York', weekly_hours: { '1': [{ start: '09:00', end: '10:00' }], '5': [{ start: '09:00', end: '10:00' }] } });
        const range = { start: new Date('2026-10-30T00:00:00Z'), end: new Date('2026-11-03T00:00:00Z') };
        const slots = computeMemberSlots(rules(), ny, range, new Date('2026-10-29T00:00:00Z'));
        expect(slots.map((s) => s.start.toISOString())).toEqual([
            '2026-10-30T13:00:00.000Z',
            '2026-10-30T13:30:00.000Z',
            '2026-11-02T14:00:00.000Z',
            '2026-11-02T14:30:00.000Z',
        ]);
    });

    it('can also list unbookable start times, flagged unavailable', () => {
        const busy = [{ start: new Date('2026-11-02T10:00:00Z'), end: new Date('2026-11-02T10:30:00Z') }];
        const all = computeMemberSlots(rules(), member({ busy }), MONDAY, NOW, { include_unavailable: true });
        expect(times(all)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30']);
        expect(all.filter((s) => !s.available).map((s) => s.start.toISOString().slice(11, 16))).toEqual(['10:00']);
        // Default behaviour is unchanged: unavailable times are dropped.
        expect(times(computeMemberSlots(rules(), member({ busy }), MONDAY, NOW))).not.toContain('10:00');
    });

    it('flags times inside the notice window as unavailable but never lists times in the past', () => {
        const now = new Date('2026-11-02T10:10:00Z');
        const all = computeMemberSlots(rules({ min_notice_minutes: 60 }), member(), MONDAY, now, { include_unavailable: true });
        expect(times(all)[0]).toBe('10:30');
        expect(all.filter((s) => !s.available).map((s) => s.start.toISOString().slice(11, 16))).toEqual(['10:30', '11:00']);
    });

    it('marks a combined slot available when any member is free', () => {
        const a = computeMemberSlots(rules(), member({ user_uuid: 'a', weekly_hours: { '1': [{ start: '09:00', end: '09:30' }] }, busy: [{ start: new Date('2026-11-02T09:00:00Z'), end: new Date('2026-11-02T09:30:00Z') }] }), MONDAY, NOW, { include_unavailable: true });
        const b = computeMemberSlots(rules(), member({ user_uuid: 'b', weekly_hours: { '1': [{ start: '09:00', end: '09:30' }] } }), MONDAY, NOW, { include_unavailable: true });
        const [slot] = combineMemberSlots([{ user_uuid: 'a', slots: a }, { user_uuid: 'b', slots: b }]);
        expect(slot.available).toBe(true);
        expect(slot.user_uuids).toEqual(['b']);
        const [none] = combineMemberSlots([{ user_uuid: 'a', slots: a }]);
        expect(none.available).toBe(false);
        expect(none.user_uuids).toEqual([]);
    });

    it('combines members so a slot is offered when anyone is free', () => {
        const a = computeMemberSlots(rules(), member({ user_uuid: 'a', weekly_hours: { '1': [{ start: '09:00', end: '10:00' }] } }), MONDAY, NOW);
        const b = computeMemberSlots(rules(), member({ user_uuid: 'b', weekly_hours: { '1': [{ start: '09:30', end: '10:30' }] } }), MONDAY, NOW);
        const combined = combineMemberSlots([{ user_uuid: 'a', slots: a }, { user_uuid: 'b', slots: b }]);
        expect(combined.map((s) => [s.start.toISOString().slice(11, 16), s.user_uuids])).toEqual([
            ['09:00', ['a']],
            ['09:30', ['a', 'b']],
            ['10:00', ['b']],
        ]);
    });
});
