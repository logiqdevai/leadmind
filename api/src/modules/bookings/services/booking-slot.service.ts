import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { DateTime } from 'luxon';
import { BookingAssignmentMode, BookingPage, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { REDIS_CLIENT } from '@/core/databases/redis/redis.constants';
import { GoogleCalendarService } from '@/integrations/composio/services/google-calendar.service';
import { CalendarConnectionsService } from './calendar-connections.service';
import {
    ACTIVE_BOOKING_STATUSES,
    EXTERNAL_BUSY_CACHE_TTL_SECONDS,
    MAX_SLOT_RANGE_DAYS,
} from '../constants/booking.constants';
import { SlotsByDate } from '../interfaces/booking.interface';
import {
    combineMemberSlots,
    CombinedSlot,
    computeMemberSlots,
    DEFAULT_WEEKLY_HOURS,
    Interval,
    isValidTimeZone,
    MemberAvailability,
    parseTimeToMinutes,
    seatsLeftForSlot,
    SlotRules,
    TimeRange,
    WeeklyHours,
} from '../utils/slot-calculation.util';

type Db = PrismaService | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

interface RecurringWindow {
    weekdays: number[];
    start_time: string;
    end_time: string;
    timezone: string;
}

/** Concrete busy intervals a weekly window produces between `from` and `to` (wall-clock times in its own timezone). */
export function expandRecurringBlock(block: RecurringWindow, from: Date, to: Date): Interval[] {
    const zone = isValidTimeZone(block.timezone) ? block.timezone : 'UTC';
    const startMinutes = parseTimeToMinutes(block.start_time);
    const endMinutes = parseTimeToMinutes(block.end_time);
    const intervals: Interval[] = [];
    let day = DateTime.fromJSDate(from, { zone }).startOf('day');
    const last = DateTime.fromJSDate(to, { zone });
    for (let guard = 0; day <= last && guard < 400; guard += 1, day = day.plus({ days: 1 })) {
        if (!block.weekdays.includes(day.weekday)) continue;
        intervals.push({
            start: day.plus({ minutes: startMinutes }).toJSDate(),
            end: day.plus({ minutes: endMinutes }).toJSDate(),
        });
    }
    return intervals;
}

/** Rules for bookings created without a page, or with "ignore availability": only overlap prevention applies. */
const UNRESTRICTED_RULES = {
    min_notice_minutes: 0,
    max_advance_days: 3650,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_gap_minutes: 0,
    max_gap_minutes: null,
    max_bookings_per_day: null,
    seats_per_slot: 1,
};

export interface SlotCheckOptions {
    /** Skip working hours, rules and blocks - only refuse overlapping bookings. */
    ignore_availability?: boolean;
    /** Check working hours, blocks and conflicts, but not notice / advance window / slot alignment (reassigning). */
    working_hours_only?: boolean;
    exclude_booking_uuid?: string | null;
    /** Consult Google free/busy (skipped inside transactions to keep locks short). */
    include_external?: boolean;
}

/** Loads availability inputs from the database and Google, then delegates to the pure slot calculation. */
@Injectable()
export class BookingSlotService {
    private readonly logger = new Logger(BookingSlotService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calendarConnections: CalendarConnectionsService,
        private readonly googleCalendar: GoogleCalendarService,
        @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    ) {}

    allowedDurations(page: Pick<BookingPage, 'duration_minutes' | 'duration_options'>): number[] {
        return [...new Set([page.duration_minutes, ...page.duration_options])].sort((a, b) => a - b);
    }

    rulesFor(page: BookingPage | null, duration?: number, options: { ignore_availability?: boolean } = {}): SlotRules {
        if (!page) {
            const minutes = duration ?? 30;
            return {
                booking_page_uuid: '',
                duration_minutes: minutes,
                slot_interval_minutes: minutes,
                ...UNRESTRICTED_RULES,
            };
        }
        const allowed = this.allowedDurations(page);
        const minutes = duration ?? page.duration_minutes;
        if (!options.ignore_availability && !allowed.includes(minutes)) {
            throw new BadRequestException(`Duration must be one of: ${allowed.join(', ')} minutes`);
        }
        const base: SlotRules = {
            booking_page_uuid: page.uuid,
            duration_minutes: minutes,
            slot_interval_minutes: page.slot_interval_minutes ?? minutes,
            min_notice_minutes: page.min_notice_minutes,
            max_advance_days: page.max_advance_days,
            buffer_before_minutes: page.buffer_before_minutes,
            buffer_after_minutes: page.buffer_after_minutes,
            min_gap_minutes: page.min_gap_minutes,
            max_gap_minutes: page.max_gap_minutes,
            max_bookings_per_day: page.max_bookings_per_day,
            seats_per_slot: page.seats_per_slot,
        };
        return options.ignore_availability ? { ...base, ...UNRESTRICTED_RULES, seats_per_slot: page.seats_per_slot } : base;
    }

    /** Page members that are still in the organisation, highest priority first. */
    async eligibleMembers(db: Db, page: Pick<BookingPage, 'uuid' | 'organisation_uuid'>) {
        return db.bookingPageMember.findMany({
            where: {
                booking_page_uuid: page.uuid,
                user: { memberships: { some: { organisation_uuid: page.organisation_uuid } } },
            },
            include: { user: { select: { uuid: true, full_name: true, email: true } } },
            orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
        });
    }

    parseRange(fromIso: string, toIso: string): Interval {
        const start = new Date(fromIso);
        const end = new Date(toIso);
        if (end <= start) throw new BadRequestException('"to" must be after "from"');
        if (end.getTime() - start.getTime() > MAX_SLOT_RANGE_DAYS * DAY_MS) {
            throw new BadRequestException(`A slot query may cover at most ${MAX_SLOT_RANGE_DAYS} days`);
        }
        return { start, end };
    }

    /** Bookable start times of a page across its eligible members (or one member). */
    async getSlots(
        page: BookingPage,
        range: Interval,
        options: {
            duration?: number;
            member_uuid?: string;
            exclude_booking_uuid?: string | null;
            now?: Date;
            /** Also return start times that can't be booked, flagged `available: false`. */
            include_unavailable?: boolean;
        } = {},
    ): Promise<CombinedSlot[]> {
        const rules = this.rulesFor(page, options.duration);
        const members = await this.eligibleMembers(this.prisma, page);
        const userUuids = members
            .map((m) => m.user_uuid)
            .filter((uuid) => !options.member_uuid || uuid === options.member_uuid);
        if (userUuids.length === 0) return [];

        const availability = await this.loadMembers(this.prisma, page.organisation_uuid, userUuids, range, {
            exclude_booking_uuid: options.exclude_booking_uuid,
            include_external: true,
        });
        const now = options.now ?? new Date();
        return combineMemberSlots(
            availability.map((member) => ({
                user_uuid: member.user_uuid,
                slots: computeMemberSlots(rules, member, range, now, { include_unavailable: options.include_unavailable }),
            })),
        );
    }

    groupByDate(slots: CombinedSlot[], timezone: string, duration_minutes: number, include_members: boolean): SlotsByDate {
        const zone = isValidTimeZone(timezone) ? timezone : 'UTC';
        const days: SlotsByDate['days'] = {};
        for (const slot of slots) {
            const date = DateTime.fromJSDate(slot.start, { zone }).toISODate()!;
            (days[date] ??= []).push({
                start: slot.start.toISOString(),
                end: slot.end.toISOString(),
                available: slot.available,
                ...(include_members && { user_uuids: slot.user_uuids }),
            });
        }
        return { timezone: zone, duration_minutes, days };
    }

    /**
     * Re-validates one concrete slot for one member against fresh data. Used inside the booking
     * transaction (after taking the member lock), so it must read through `db`.
     */
    async isSlotAvailable(
        db: Db,
        organisation_uuid: string,
        rules: SlotRules,
        user_uuid: string,
        slot: Interval,
        options: SlotCheckOptions = {},
    ): Promise<boolean> {
        const [member] = await this.loadMembers(db, organisation_uuid, [user_uuid], slot, {
            exclude_booking_uuid: options.exclude_booking_uuid,
            include_external: options.include_external ?? false,
        });

        if (options.ignore_availability) {
            // Only refuse overlaps with other bookings (seats still apply for group pages).
            return seatsLeftForSlot(rules, { ...member, busy: [] }, slot, { ignore_working_hours: true }) > 0;
        }
        if (options.working_hours_only) return seatsLeftForSlot(rules, member, slot) > 0;
        // Recomputing the offered slots around the instant also enforces notice, advance window and alignment.
        const offered = computeMemberSlots(rules, member, { start: slot.start, end: new Date(slot.start.getTime() + 1) }, new Date());
        return offered.some((s) => s.start.getTime() === slot.start.getTime());
    }

    /** Orders candidate members for automatic assignment. */
    async rankCandidates(
        page: Pick<BookingPage, 'uuid' | 'organisation_uuid' | 'assignment_mode'>,
        candidates: string[],
        slotStart: Date,
    ): Promise<string[]> {
        if (candidates.length <= 1) return candidates;
        const members = await this.prisma.bookingPageMember.findMany({
            where: { booking_page_uuid: page.uuid, user_uuid: { in: candidates } },
        });
        const byUser = new Map(members.map((m) => [m.user_uuid, m]));

        let dayCounts = new Map<string, number>();
        if (page.assignment_mode === BookingAssignmentMode.LEAST_BUSY) {
            const dayStart = new Date(slotStart.getTime() - DAY_MS / 2);
            const dayEnd = new Date(slotStart.getTime() + DAY_MS / 2);
            const counts = await this.prisma.booking.groupBy({
                by: ['assigned_user_uuid'],
                where: {
                    organisation_uuid: page.organisation_uuid,
                    assigned_user_uuid: { in: candidates },
                    status: { in: ACTIVE_BOOKING_STATUSES },
                    start_at: { gte: dayStart, lt: dayEnd },
                },
                _count: { _all: true },
            });
            dayCounts = new Map(counts.map((c) => [c.assigned_user_uuid!, c._count._all]));
        }

        const lastAssigned = (uuid: string) => byUser.get(uuid)?.last_assigned_at?.getTime() ?? 0;
        const priority = (uuid: string) => byUser.get(uuid)?.priority ?? 0;
        return [...candidates].sort((a, b) => {
            if (page.assignment_mode === BookingAssignmentMode.LEAST_BUSY) {
                const diff = (dayCounts.get(a) ?? 0) - (dayCounts.get(b) ?? 0);
                if (diff !== 0) return diff;
                if (priority(a) !== priority(b)) return priority(b) - priority(a);
                return lastAssigned(a) - lastAssigned(b);
            }
            // Round robin: least recently assigned first, priority breaks ties.
            const diff = lastAssigned(a) - lastAssigned(b);
            return diff !== 0 ? diff : priority(b) - priority(a);
        });
    }

    async loadMembers(
        db: Db,
        organisation_uuid: string,
        user_uuids: string[],
        range: Interval,
        options: { exclude_booking_uuid?: string | null; include_external?: boolean },
    ): Promise<MemberAvailability[]> {
        // Pad so whole local days (any timezone) around the range are visible for daily limits.
        const from = new Date(range.start.getTime() - DAY_MS - 14 * 3600_000);
        const to = new Date(range.end.getTime() + DAY_MS + 14 * 3600_000);
        const fromDate = from.toISOString().slice(0, 10);
        const toDate = to.toISOString().slice(0, 10);

        const [organisation, schedules, blocks, recurringBlocks, bookings] = await Promise.all([
            db.organisation.findUniqueOrThrow({ where: { uuid: organisation_uuid }, select: { timezone: true } }),
            db.availabilitySchedule.findMany({
                where: { organisation_uuid, user_uuid: { in: user_uuids } },
                include: { overrides: { where: { date: { gte: fromDate, lte: toDate } } } },
            }),
            db.bookingBlock.findMany({
                where: {
                    organisation_uuid,
                    OR: [{ user_uuid: { in: user_uuids } }, { user_uuid: null }],
                    start_at: { lt: to },
                    end_at: { gt: from },
                },
                select: { user_uuid: true, start_at: true, end_at: true },
            }),
            db.bookingRecurringBlock.findMany({
                where: { organisation_uuid, OR: [{ user_uuid: { in: user_uuids } }, { user_uuid: null }] },
                select: { user_uuid: true, weekdays: true, start_time: true, end_time: true, timezone: true },
            }),
            db.booking.findMany({
                where: {
                    organisation_uuid,
                    assigned_user_uuid: { in: user_uuids },
                    status: { in: ACTIVE_BOOKING_STATUSES },
                    start_at: { lt: to },
                    end_at: { gt: from },
                },
                select: {
                    uuid: true,
                    assigned_user_uuid: true,
                    start_at: true,
                    end_at: true,
                    booking_page_uuid: true,
                    booking_page: { select: { buffer_before_minutes: true, buffer_after_minutes: true } },
                },
            }),
        ]);

        const external = options.include_external
            ? await Promise.all(user_uuids.map((uuid) => this.externalBusy(organisation_uuid, uuid, from, to)))
            : user_uuids.map(() => [] as Interval[]);

        return user_uuids.map((user_uuid, index) => {
            const schedule = schedules.find((s) => s.user_uuid === user_uuid);
            const own = bookings.filter((b) => b.assigned_user_uuid === user_uuid);
            // Google free/busy also reports the events we synced for our own bookings. Those are already
            // accounted for as bookings (with seat logic), so drop busy intervals one of them fully covers.
            const externalBusy = external[index].filter(
                (busy) => !own.some((b) => b.start_at <= busy.start && b.end_at >= busy.end),
            );
            return {
                user_uuid,
                timezone: schedule?.timezone ?? organisation.timezone ?? 'UTC',
                weekly_hours: (schedule?.weekly_hours as unknown as WeeklyHours | undefined) ?? DEFAULT_WEEKLY_HOURS,
                overrides: Object.fromEntries(
                    (schedule?.overrides ?? []).map((o) => [o.date, o.intervals as unknown as TimeRange[]]),
                ),
                busy: [
                    ...blocks
                        .filter((b) => b.user_uuid === null || b.user_uuid === user_uuid)
                        .map((b) => ({ start: b.start_at, end: b.end_at })),
                    ...recurringBlocks
                        .filter((b) => b.user_uuid === null || b.user_uuid === user_uuid)
                        .flatMap((b) => expandRecurringBlock(b, from, to)),
                    ...externalBusy,
                ],
                bookings: own
                    .filter((b) => b.uuid !== options.exclude_booking_uuid)
                    .map((b) => ({
                        start: b.start_at,
                        end: b.end_at,
                        booking_page_uuid: b.booking_page_uuid,
                        buffer_before_minutes: b.booking_page?.buffer_before_minutes ?? 0,
                        buffer_after_minutes: b.booking_page?.buffer_after_minutes ?? 0,
                    })),
            };
        });
    }

    /** Busy time from the member's connected Google Calendar (if conflict checking is on), cached briefly. */
    private async externalBusy(organisation_uuid: string, user_uuid: string, from: Date, to: Date): Promise<Interval[]> {
        const connection = await this.calendarConnections.findUsable(organisation_uuid, user_uuid);
        if (!connection?.check_conflicts) return [];

        const cacheKey = `booking-busy:${connection.uuid}:${connection.calendar_id}:${Math.floor(from.getTime() / 60_000)}:${Math.floor(to.getTime() / 60_000)}`;
        const cached = await this.cacheGet(cacheKey);
        if (cached) return cached;

        try {
            const busy = await this.googleCalendar.getBusyIntervals(
                connection.composio_connected_account_id,
                connection.calendar_id,
                from,
                to,
            );
            await this.cacheSet(cacheKey, busy);
            return busy;
        } catch (error) {
            // Availability must keep working when Google is down; internal bookings still prevent double booking.
            this.logger.warn(`Free/busy lookup failed for connection ${connection.uuid}: ${(error as Error).message}`);
            await this.calendarConnections.handleProviderError(connection.uuid, error);
            return [];
        }
    }

    private async cacheGet(key: string): Promise<Interval[] | null> {
        if (!this.redis) return null;
        try {
            const raw = await this.redis.get(key);
            if (!raw) return null;
            return (JSON.parse(raw) as { start: string; end: string }[]).map((i) => ({ start: new Date(i.start), end: new Date(i.end) }));
        } catch {
            return null;
        }
    }

    private async cacheSet(key: string, value: Interval[]) {
        if (!this.redis) return;
        try {
            await this.redis.set(key, JSON.stringify(value), 'EX', EXTERNAL_BUSY_CACHE_TTL_SECONDS);
        } catch {
            // cache is best effort
        }
    }
}
