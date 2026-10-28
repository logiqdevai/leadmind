import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    Booking,
    BookingActorType,
    BookingEventType,
    BookingLocationType,
    BookingPage,
    BookingSource,
    BookingStatus,
    InteractionType,
    NotificationType,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { NotificationsGateway } from '@/gateways/notifications.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { generateManageToken } from '@/modules/booking-links/utils/booking-url.util';
import { BookingActor, isOrganisationAdmin } from './interfaces/booking.interface';
import { ACTIVE_BOOKING_STATUSES, BookingErrorCodes } from './constants/booking.constants';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFiltersDto, ListBookingsDto } from './dto/list-bookings.dto';
import {
    AssignBookingDto,
    CancelBookingDto,
    RescheduleBookingDto,
    UpdateBookingDto,
    UpdateBookingStatusDto,
} from './dto/booking-actions.dto';
import { BookingSlotService } from './services/booking-slot.service';
import { BookingEventActor, BookingEventsService, userActor } from './services/booking-events.service';
import { BookingNotificationsService } from './services/booking-notifications.service';
import { BookingTeamReminderService } from './services/booking-team-reminder.service';
import { BookingCalendarSyncService } from './services/booking-calendar-sync.service';
import { CalendarConnectionsService } from './services/calendar-connections.service';
import { GoogleCalendarService } from '@/integrations/composio/services/google-calendar.service';
import { bookingsToCsv } from './utils/booking-csv.util';

export const BOOKING_LIST_INCLUDE = {
    booking_page: { select: { uuid: true, name: true, slug: true, primary_color: true } },
    contact: { select: { uuid: true, name: true, email: true, phone: true, company: true } },
    assigned_user: { select: { uuid: true, full_name: true, email: true } },
} satisfies Prisma.BookingInclude;

const SAFE_BOOKING_OMIT = { manage_token: true } as const;

class SlotTakenError extends Error {}

export interface PlaceBookingInput {
    organisation_uuid: string;
    page: BookingPage | null;
    start: Date;
    duration_minutes: number;
    /** Members to try, in order. The first one free at the slot gets the booking. */
    candidates: string[];
    ignore_availability: boolean;
    /** Team members may pick any time inside working hours; invitees only offered slots. */
    working_hours_only?: boolean;
    source: BookingSource;
    status: BookingStatus;
    booking_link_uuid?: string | null;
    contact_uuid?: string | null;
    created_by_user_uuid?: string | null;
    invitee: {
        name: string;
        email: string;
        phone?: string | null;
        notes?: string | null;
        timezone?: string | null;
    };
    location_type: BookingLocationType;
    location_value?: string | null;
    answers?: Record<string, unknown> | null;
    internal_notes?: string | null;
    actor: BookingEventActor;
}

@Injectable()
export class BookingsService {
    private readonly logger = new Logger(BookingsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly slotService: BookingSlotService,
        private readonly events: BookingEventsService,
        private readonly notifications: BookingNotificationsService,
        private readonly calendarSync: BookingCalendarSyncService,
        private readonly calendarConnections: CalendarConnectionsService,
        private readonly gateway: NotificationsGateway,
        private readonly teamReminders: BookingTeamReminderService,
        private readonly inAppNotifications: NotificationsService,
        private readonly googleCalendar: GoogleCalendarService,
    ) {}

    // --- Queries ---
    async findAll(organisation_uuid: string, query: ListBookingsDto) {
        const where = this.buildWhere(organisation_uuid, query);
        const page = query.page ?? 1;
        const limit = query.limit ?? 25;
        const [data, total] = await Promise.all([
            this.prisma.booking.findMany({
                where,
                include: BOOKING_LIST_INCLUDE,
                omit: SAFE_BOOKING_OMIT,
                orderBy: { [query.order_by ?? 'start_at']: query.order_direction ?? 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.booking.count({ where }),
        ]);
        const total_pages = Math.ceil(total / limit);
        return {
            data,
            pagination: { total, page, limit, total_pages, has_next: page < total_pages, has_prev: page > 1 },
        };
    }

    /** Everything the calendar views need for a date range: bookings plus blocked periods. */
    async calendar(organisation_uuid: string, query: BookingFiltersDto) {
        if (!query.from || !query.to) throw new BadRequestException('"from" and "to" are required');
        const from = new Date(query.from);
        const to = new Date(query.to);
        const memberFilter =
            query.assigned_user_uuid && query.assigned_user_uuid !== 'unassigned' ? query.assigned_user_uuid : undefined;
        const [bookings, blocks] = await Promise.all([
            this.prisma.booking.findMany({
                where: { ...this.buildWhere(organisation_uuid, { ...query, from: undefined, to: undefined }), start_at: { lt: to }, end_at: { gt: from } },
                include: BOOKING_LIST_INCLUDE,
                omit: SAFE_BOOKING_OMIT,
                orderBy: { start_at: 'asc' },
                take: 2000,
            }),
            this.prisma.bookingBlock.findMany({
                where: {
                    organisation_uuid,
                    start_at: { lt: to },
                    end_at: { gt: from },
                    ...(memberFilter && { OR: [{ user_uuid: memberFilter }, { user_uuid: null }] }),
                },
                include: { user: { select: { uuid: true, full_name: true, email: true } } },
                orderBy: { start_at: 'asc' },
            }),
        ]);
        return { bookings, blocks };
    }

    async stats(organisation_uuid: string, query: BookingFiltersDto) {
        const where = this.buildWhere(organisation_uuid, query);
        const [byStatus, byPage, byMember, bySource] = await Promise.all([
            this.prisma.booking.groupBy({ by: ['status'], where, _count: { _all: true } }),
            this.prisma.booking.groupBy({ by: ['booking_page_uuid'], where, _count: { _all: true } }),
            this.prisma.booking.groupBy({ by: ['assigned_user_uuid'], where, _count: { _all: true } }),
            this.prisma.booking.groupBy({ by: ['source'], where, _count: { _all: true } }),
        ]);
        const count = (rows: { _count: { _all: number } }[]) => rows.reduce((sum, r) => sum + r._count._all, 0);
        return {
            total: count(byStatus),
            by_status: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
            by_source: Object.fromEntries(bySource.map((r) => [r.source, r._count._all])),
            by_page: byPage.map((r) => ({ booking_page_uuid: r.booking_page_uuid, count: r._count._all })),
            by_member: byMember.map((r) => ({ assigned_user_uuid: r.assigned_user_uuid, count: r._count._all })),
        };
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const booking = await this.prisma.booking.findFirst({
            where: { uuid, organisation_uuid },
            include: {
                ...BOOKING_LIST_INCLUDE,
                booking_link: { select: { uuid: true, code: true, label: true, contact_uuid: true } },
                created_by: { select: { uuid: true, full_name: true, email: true } },
                events: {
                    orderBy: { created_at: 'desc' },
                    include: { actor: { select: { uuid: true, full_name: true, email: true } } },
                },
                notifications: { orderBy: { created_at: 'desc' } },
            },
            omit: SAFE_BOOKING_OMIT,
        });
        if (!booking) throw new NotFoundException('Booking not found');
        return booking;
    }

    async exportCsv(organisation_uuid: string, query: BookingFiltersDto): Promise<string> {
        const bookings = await this.prisma.booking.findMany({
            where: this.buildWhere(organisation_uuid, query),
            include: BOOKING_LIST_INCLUDE,
            omit: SAFE_BOOKING_OMIT,
            orderBy: { start_at: 'asc' },
            take: 10000,
        });
        return bookingsToCsv(bookings);
    }

    // --- Internal actions ---
    async createManual(actor: BookingActor, dto: CreateBookingDto) {
        const page = dto.booking_page_uuid ? await this.findPage(actor.organisation_uuid, dto.booking_page_uuid) : null;
        if (dto.assigned_user_uuid && dto.assigned_user_uuid !== actor.uuid && !isOrganisationAdmin(actor)) {
            throw new ForbiddenException('Only admins can assign bookings to other members');
        }
        if (dto.assigned_user_uuid) await this.assertOrgMember(actor.organisation_uuid, dto.assigned_user_uuid);

        const contact = dto.contact_uuid
            ? await this.prisma.contact.findFirst({ where: { uuid: dto.contact_uuid, organisation_uuid: actor.organisation_uuid } })
            : null;
        if (dto.contact_uuid && !contact) throw new NotFoundException('Contact not found');
        const email = dto.invitee_email ?? contact?.email;
        if (!email) throw new BadRequestException('An email address is required (the contact has none)');

        const start = new Date(dto.start_at);
        const duration = dto.duration_minutes ?? page?.duration_minutes ?? 30;
        const candidates = await this.candidatesFor(page, dto.assigned_user_uuid ?? (page ? undefined : actor.uuid), start);

        const booking = await this.placeBooking({
            organisation_uuid: actor.organisation_uuid,
            page,
            start,
            duration_minutes: duration,
            candidates,
            ignore_availability: !!dto.ignore_availability,
            working_hours_only: true,
            source: BookingSource.MANUAL,
            status: BookingStatus.CONFIRMED,
            contact_uuid: contact?.uuid ?? null,
            created_by_user_uuid: actor.uuid,
            invitee: {
                name: dto.invitee_name ?? contact?.name ?? email,
                email,
                phone: dto.invitee_phone ?? contact?.phone ?? null,
                notes: dto.invitee_notes ?? null,
                timezone: dto.invitee_timezone ?? null,
            },
            location_type: dto.location_type ?? page?.location_type ?? BookingLocationType.NONE,
            location_value: dto.location_value ?? page?.location_value ?? null,
            answers: dto.answers ?? null,
            internal_notes: dto.internal_notes ?? null,
            actor: userActor(actor.uuid),
        });
        await this.afterCreate(booking, { notify: dto.notify ?? true });
        return this.findOne(actor.organisation_uuid, booking.uuid);
    }

    async update(actor: BookingActor, uuid: string, dto: UpdateBookingDto) {
        const booking = await this.findModifiable(actor, uuid);
        const updated = await this.prisma.booking.update({
            where: { uuid },
            data: {
                ...(dto.invitee_name !== undefined && { invitee_name: dto.invitee_name }),
                ...(dto.invitee_email !== undefined && { invitee_email: dto.invitee_email }),
                ...(dto.invitee_phone !== undefined && { invitee_phone: dto.invitee_phone || null }),
                ...(dto.invitee_notes !== undefined && { invitee_notes: dto.invitee_notes || null }),
                ...(dto.internal_notes !== undefined && { internal_notes: dto.internal_notes || null }),
                ...(dto.location_type !== undefined && { location_type: dto.location_type }),
                ...(dto.location_value !== undefined && { location_value: dto.location_value || null }),
                // Leaving Google Meet drops the old link; switching to it gets a new one on sync.
                ...(dto.location_type !== undefined && dto.location_type !== booking.location_type && { meeting_url: null }),
            },
        });
        const notesOnly = Object.keys(dto).every((k) => k === 'internal_notes');
        await this.events.record(
            booking,
            notesOnly ? BookingEventType.NOTE_UPDATED : BookingEventType.UPDATED,
            userActor(actor.uuid),
            notesOnly ? 'Internal notes updated' : 'Booking details updated',
            { fields: Object.keys(dto) },
        );
        await this.safely(() => this.calendarSync.enqueue(updated), 'calendar sync');
        await this.teamReminders.syncSafely(uuid, 'updated');
        return this.findOne(actor.organisation_uuid, uuid);
    }

    async reschedule(actor: BookingActor, uuid: string, dto: RescheduleBookingDto) {
        const booking = await this.findModifiable(actor, uuid);
        if (dto.assigned_user_uuid && dto.assigned_user_uuid !== booking.assigned_user_uuid && !isOrganisationAdmin(actor)) {
            throw new ForbiddenException('Only admins can reassign bookings');
        }
        if (dto.assigned_user_uuid) await this.assertOrgMember(actor.organisation_uuid, dto.assigned_user_uuid);
        await this.moveBooking(booking, new Date(dto.start_at), {
            assignee: dto.assigned_user_uuid,
            ignore_availability: !!dto.ignore_availability,
            working_hours_only: true,
            notify: dto.notify ?? true,
            actor: userActor(actor.uuid),
        });
        return this.findOne(actor.organisation_uuid, uuid);
    }

    async cancel(actor: BookingActor, uuid: string, dto: CancelBookingDto) {
        const booking = await this.findModifiable(actor, uuid);
        await this.cancelBooking(booking, {
            reason: dto.reason ?? null,
            notify: dto.notify ?? true,
            actor: userActor(actor.uuid),
        });
        return this.findOne(actor.organisation_uuid, uuid);
    }

    async setStatus(actor: BookingActor, uuid: string, dto: UpdateBookingStatusDto) {
        const booking = await this.findModifiable(actor, uuid);
        if (booking.status === BookingStatus.CANCELLED) throw new BadRequestException('Cancelled bookings cannot change status');
        if (booking.status === dto.status) return this.findOne(actor.organisation_uuid, uuid);

        if (dto.status === BookingStatus.CONFIRMED) {
            if (booking.status !== BookingStatus.PENDING) throw new BadRequestException('Only pending bookings can be confirmed');
            const confirmed = await this.prisma.booking.update({
                where: { uuid },
                data: { status: BookingStatus.CONFIRMED, confirmed_at: new Date() },
            });
            await this.events.record(booking, BookingEventType.CONFIRMED, userActor(actor.uuid), 'Booking confirmed');
            await this.sendConfirmationAndSync(confirmed, true);
            await this.teamReminders.syncSafely(uuid, 'confirmed');
            return this.findOne(actor.organisation_uuid, uuid);
        }

        if (booking.start_at > new Date()) {
            throw new BadRequestException('Only meetings that have started can be marked completed or no-show');
        }
        await this.prisma.booking.update({
            where: { uuid },
            data: {
                status: dto.status,
                completed_at: dto.status === BookingStatus.COMPLETED ? new Date() : null,
            },
        });
        await this.events.record(booking, BookingEventType.STATUS_CHANGED, userActor(actor.uuid), `Marked ${labelForStatus(dto.status)}`, {
            from: booking.status,
            to: dto.status,
        });
        // A finished meeting no longer needs its pending reminder.
        await this.teamReminders.syncSafely(uuid, 'status');
        return this.findOne(actor.organisation_uuid, uuid);
    }

    async assign(actor: BookingActor, uuid: string, dto: AssignBookingDto) {
        if (!isOrganisationAdmin(actor)) throw new ForbiddenException('Only admins can reassign bookings');
        const booking = await this.findBooking(actor.organisation_uuid, uuid);
        if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) throw new BadRequestException('Only upcoming bookings can be reassigned');
        if (booking.assigned_user_uuid === dto.assigned_user_uuid) return this.findOne(actor.organisation_uuid, uuid);
        await this.assertOrgMember(actor.organisation_uuid, dto.assigned_user_uuid);

        const page = booking.booking_page_uuid ? await this.findPage(actor.organisation_uuid, booking.booking_page_uuid) : null;
        const ignore = !!dto.ignore_availability || !page;
        const rules = this.slotService.rulesFor(page, booking.duration_minutes, { ignore_availability: ignore });
        const slot = { start: booking.start_at, end: booking.end_at };

        const updated = await this.prisma.$transaction(async (tx) => {
            await this.lockMember(tx, dto.assigned_user_uuid);
            // The new member's own working hours and blocks apply (unless overridden); notice rules don't.
            const free = await this.slotService.isSlotAvailable(tx, actor.organisation_uuid, rules, dto.assigned_user_uuid, slot, {
                ignore_availability: ignore,
                working_hours_only: !ignore,
                exclude_booking_uuid: booking.uuid,
            });
            if (!free) throw new ConflictException({ message: 'That member is not free at this time', code: BookingErrorCodes.SLOT_UNAVAILABLE });
            const result = await tx.booking.update({ where: { uuid }, data: { assigned_user_uuid: dto.assigned_user_uuid } });
            await this.events.record(booking, BookingEventType.ASSIGNED, userActor(actor.uuid), 'Booking reassigned', {
                from: booking.assigned_user_uuid,
                to: dto.assigned_user_uuid,
            }, tx);
            return result;
        });
        await this.safely(() => this.calendarSync.enqueue(updated), 'calendar sync');
        await this.teamReminders.syncSafely(uuid, 'updated');
        this.emit(updated.assigned_user_uuid, 'booking.assigned', updated);
        await this.notifyAssignee(updated, 'ASSIGNED', actor.uuid);
        return this.findOne(actor.organisation_uuid, uuid);
    }

    /** Permanently removes a booking (admins): its Google event, queued reminders and history go with it. */
    async remove(actor: BookingActor, uuid: string) {
        if (!isOrganisationAdmin(actor)) throw new ForbiddenException('Only admins can delete bookings');
        const booking = await this.prisma.booking.findFirst({
            where: { uuid, organisation_uuid: actor.organisation_uuid },
            include: { calendar_connection: true },
        });
        if (!booking) throw new NotFoundException('Booking not found');

        await this.safely(async () => {
            await this.notifications.cancelReminders(booking.uuid, booking.start_at, booking.booking_page_uuid);
            const connection = booking.calendar_connection;
            if (booking.calendar_event_id && connection?.composio_connected_account_id) {
                await this.googleCalendar.deleteEvent(connection.composio_connected_account_id, connection.calendar_id, booking.calendar_event_id);
            }
        }, 'delete side effects');
        if (booking.reminder_uuid) {
            await this.safely(() => this.prisma.reminder.delete({ where: { uuid: booking.reminder_uuid! } }), 'team reminder removal');
        }
        await this.prisma.booking.delete({ where: { uuid } });
        return { success: true };
    }

    /** Manual retry after a failed sync (e.g. once the member reconnected Google). */
    async resyncCalendar(organisation_uuid: string, uuid: string) {
        const booking = await this.findBooking(organisation_uuid, uuid);
        await this.calendarSync.enqueue({ uuid: booking.uuid, updated_at: new Date() });
        return { queued: true };
    }

    // --- Shared lifecycle core (also used by public booking pages) ---

    /**
     * Creates a booking with double-booking protection: per member, a transaction-scoped Postgres
     * advisory lock serialises concurrent attempts, then the slot is re-validated against fresh data
     * before inserting. Members are tried in order; the first free one gets the booking.
     */
    async placeBooking(input: PlaceBookingInput): Promise<Booking> {
        const rules = this.slotService.rulesFor(input.page, input.duration_minutes, {
            ignore_availability: input.ignore_availability,
        });
        const slot = { start: input.start, end: new Date(input.start.getTime() + input.duration_minutes * 60_000) };
        if (Number.isNaN(slot.start.getTime())) throw new BadRequestException('Invalid start time');

        // External (Google) busy time is checked before taking locks - it's slow and not transactional.
        const candidates = input.ignore_availability
            ? input.candidates
            : await this.filterAsync(input.candidates, (uuid) =>
                  this.slotService.isSlotAvailable(this.prisma, input.organisation_uuid, rules, uuid, slot, {
                      include_external: true,
                      working_hours_only: input.working_hours_only,
                  }),
              );

        for (const user_uuid of candidates) {
            try {
                return await this.prisma.$transaction(
                    async (tx) => {
                        await this.lockMember(tx, user_uuid);
                        const free = await this.slotService.isSlotAvailable(tx, input.organisation_uuid, rules, user_uuid, slot, {
                            ignore_availability: input.ignore_availability,
                            working_hours_only: input.working_hours_only,
                        });
                        if (!free) throw new SlotTakenError();

                        const booking = await tx.booking.create({
                            data: {
                                organisation_uuid: input.organisation_uuid,
                                booking_page_uuid: input.page?.uuid ?? null,
                                booking_link_uuid: input.booking_link_uuid ?? null,
                                contact_uuid: input.contact_uuid ?? null,
                                assigned_user_uuid: user_uuid,
                                created_by_user_uuid: input.created_by_user_uuid ?? null,
                                source: input.source,
                                status: input.status,
                                start_at: slot.start,
                                end_at: slot.end,
                                duration_minutes: input.duration_minutes,
                                invitee_timezone: input.invitee.timezone ?? null,
                                invitee_name: input.invitee.name,
                                invitee_email: input.invitee.email.trim().toLowerCase(),
                                invitee_phone: input.invitee.phone || null,
                                invitee_notes: input.invitee.notes || null,
                                answers: (input.answers ?? undefined) as Prisma.InputJsonValue | undefined,
                                internal_notes: input.internal_notes ?? null,
                                location_type: input.location_type,
                                location_value: input.location_value ?? null,
                                manage_token: generateManageToken(),
                                confirmed_at: input.status === BookingStatus.CONFIRMED ? new Date() : null,
                            },
                        });
                        await this.events.record(booking, BookingEventType.CREATED, input.actor, creationSummary(input), {
                            source: input.source,
                            status: input.status,
                        }, tx);
                        await this.events.record(booking, BookingEventType.ASSIGNED, input.actor, 'Assigned to team member', {
                            to: user_uuid,
                            automatic: input.candidates.length > 1,
                        }, tx);
                        if (input.page) {
                            await tx.bookingPageMember.updateMany({
                                where: { booking_page_uuid: input.page.uuid, user_uuid },
                                data: { last_assigned_at: new Date() },
                            });
                        }
                        if (input.booking_link_uuid) {
                            await tx.bookingLink.update({ where: { uuid: input.booking_link_uuid }, data: { last_used_at: new Date() } });
                        }
                        return booking;
                    },
                    { timeout: 15_000 },
                );
            } catch (error) {
                if (error instanceof SlotTakenError) continue;
                throw error;
            }
        }
        throw new ConflictException({
            message: 'That time is no longer available. Please pick another slot.',
            code: BookingErrorCodes.SLOT_UNAVAILABLE,
        });
    }

    async moveBooking(
        booking: Booking,
        start: Date,
        options: {
            assignee?: string;
            ignore_availability: boolean;
            working_hours_only?: boolean;
            notify: boolean;
            actor: BookingEventActor;
        },
    ): Promise<Booking> {
        if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) throw new BadRequestException('Only upcoming bookings can be rescheduled');
        if (Number.isNaN(start.getTime())) throw new BadRequestException('Invalid start time');
        const page = booking.booking_page_uuid ? await this.findPage(booking.organisation_uuid, booking.booking_page_uuid) : null;
        const rules = this.slotService.rulesFor(page, booking.duration_minutes, { ignore_availability: options.ignore_availability });
        const slot = { start, end: new Date(start.getTime() + booking.duration_minutes * 60_000) };

        // Prefer keeping the current member; fall back to other eligible members (round robin order).
        const preferred = options.assignee ?? booking.assigned_user_uuid;
        let candidates = preferred ? [preferred] : [];
        if (!options.assignee && page) {
            const others = (await this.slotService.eligibleMembers(this.prisma, page)).map((m) => m.user_uuid).filter((u) => u !== preferred);
            candidates = [...candidates, ...(await this.slotService.rankCandidates(page, others, start))];
        }
        if (!options.ignore_availability) {
            candidates = await this.filterAsync(candidates, (uuid) =>
                this.slotService.isSlotAvailable(this.prisma, booking.organisation_uuid, rules, uuid, slot, {
                    include_external: true,
                    working_hours_only: options.working_hours_only,
                    exclude_booking_uuid: booking.uuid,
                }),
            );
        }

        for (const user_uuid of candidates) {
            try {
                const moved = await this.prisma.$transaction(
                    async (tx) => {
                        await this.lockMember(tx, user_uuid);
                        const free = await this.slotService.isSlotAvailable(tx, booking.organisation_uuid, rules, user_uuid, slot, {
                            ignore_availability: options.ignore_availability,
                            working_hours_only: options.working_hours_only,
                            exclude_booking_uuid: booking.uuid,
                        });
                        if (!free) throw new SlotTakenError();
                        const updated = await tx.booking.update({
                            where: { uuid: booking.uuid },
                            data: {
                                start_at: slot.start,
                                end_at: slot.end,
                                assigned_user_uuid: user_uuid,
                                status: booking.status === BookingStatus.PENDING ? BookingStatus.PENDING : BookingStatus.RESCHEDULED,
                                reschedule_count: { increment: 1 },
                            },
                        });
                        await this.events.record(booking, BookingEventType.RESCHEDULED, options.actor, 'Booking rescheduled', {
                            from: { start_at: booking.start_at, end_at: booking.end_at },
                            to: { start_at: slot.start, end_at: slot.end },
                        }, tx);
                        if (user_uuid !== booking.assigned_user_uuid) {
                            await this.events.record(booking, BookingEventType.ASSIGNED, options.actor, 'Reassigned while rescheduling', {
                                from: booking.assigned_user_uuid,
                                to: user_uuid,
                            }, tx);
                        }
                        return updated;
                    },
                    { timeout: 15_000 },
                );

                await this.safely(async () => {
                    await this.notifications.cancelReminders(booking.uuid, booking.start_at, booking.booking_page_uuid);
                    if (moved.status !== BookingStatus.PENDING) {
                        if (options.notify) {
                            await this.notifications.enqueue(moved, 'RESCHEDULE');
                            await this.notifications.scheduleReminders(moved);
                        }
                        await this.calendarSync.enqueue(moved);
                    }
                }, 'reschedule side effects');
                // Independent of email notifications: the team reminder follows the new time either way.
                await this.teamReminders.syncSafely(moved.uuid, 'rescheduled');
                this.emit(moved.assigned_user_uuid, 'booking.rescheduled', moved);
                await this.notifyAssignee(moved, 'RESCHEDULED', options.actor.user_uuid);
                return moved;
            } catch (error) {
                if (error instanceof SlotTakenError) continue;
                throw error;
            }
        }
        throw new ConflictException({
            message: 'That time is no longer available. Please pick another slot.',
            code: BookingErrorCodes.SLOT_UNAVAILABLE,
        });
    }

    async cancelBooking(booking: Booking, options: { reason: string | null; notify: boolean; actor: BookingEventActor }) {
        if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) throw new BadRequestException('This booking is not active');
        const cancelled = await this.prisma.booking.update({
            where: { uuid: booking.uuid },
            data: {
                status: BookingStatus.CANCELLED,
                cancelled_at: new Date(),
                cancellation_reason: options.reason,
                cancelled_by: options.actor.type,
            },
        });
        await this.events.record(booking, BookingEventType.CANCELLED, options.actor, 'Booking cancelled', {
            reason: options.reason,
            by: options.actor.type,
        });
        await this.safely(async () => {
            await this.notifications.cancelReminders(booking.uuid, booking.start_at, booking.booking_page_uuid);
            // An unconfirmed request never got a confirmation, so it doesn't get a cancellation either.
            if (options.notify && booking.status !== BookingStatus.PENDING) await this.notifications.enqueue(cancelled, 'CANCELLATION');
            await this.calendarSync.enqueue(cancelled);
            if (cancelled.contact_uuid) {
                await this.logContactInteraction(cancelled, InteractionType.BOOKING_CANCELLED, 'Booking cancelled', options.actor);
            }
        }, 'cancellation side effects');
        await this.teamReminders.syncSafely(cancelled.uuid, 'cancelled');
        this.emit(cancelled.assigned_user_uuid, 'booking.cancelled', cancelled);
        await this.notifyAssignee(cancelled, 'CANCELLED', options.actor.user_uuid);
        return cancelled;
    }

    /** Notifications, calendar sync, contact timeline and in-app alert for a newly created booking. */
    async afterCreate(booking: Booking, options: { notify: boolean }) {
        await this.safely(async () => {
            if (booking.contact_uuid) {
                await this.logContactInteraction(booking, InteractionType.BOOKING_SCHEDULED, 'Booking scheduled', {
                    type: booking.created_by_user_uuid ? BookingActorType.USER : BookingActorType.INVITEE,
                    user_uuid: booking.created_by_user_uuid,
                });
            }
            if (booking.status !== BookingStatus.PENDING) await this.sendConfirmationAndSync(booking, options.notify);
        }, 'booking side effects');
        // Pending requests get their reminder once confirmed (setStatus); this is a no-op for them.
        await this.teamReminders.syncSafely(booking.uuid, 'created');
        this.emit(booking.assigned_user_uuid, booking.status === BookingStatus.PENDING ? 'booking.requested' : 'booking.created', booking);
        await this.notifyAssignee(booking, booking.status === BookingStatus.PENDING ? 'REQUESTED' : 'CREATED', booking.created_by_user_uuid);
    }

    /**
     * With Google Meet the confirmation waits for the calendar sync, so it can carry the Meet link.
     * The sync worker sends it after success or its final failed attempt.
     */
    private async sendConfirmationAndSync(booking: Booking, notify: boolean) {
        const connection =
            booking.assigned_user_uuid && booking.location_type === BookingLocationType.GOOGLE_MEET
                ? await this.calendarConnections.findUsable(booking.organisation_uuid, booking.assigned_user_uuid)
                : null;
        await this.calendarSync.enqueue(booking, { notify_confirmation_after: notify && !!connection });
        if (notify) {
            if (!connection) await this.notifications.enqueue(booking, 'CONFIRMATION');
            await this.notifications.scheduleReminders(booking);
        }
    }

    // --- Helpers ---
    private async candidatesFor(page: BookingPage | null, explicit: string | undefined, start: Date): Promise<string[]> {
        if (explicit) return [explicit];
        if (!page) return [];
        const members = (await this.slotService.eligibleMembers(this.prisma, page)).map((m) => m.user_uuid);
        return this.slotService.rankCandidates(page, members, start);
    }

    /** Serialises booking writes per member for the rest of the transaction (released on commit/rollback). */
    private async lockMember(tx: Prisma.TransactionClient, user_uuid: string) {
        // Advisory locks have no Prisma API; the parameterised query is injection-safe.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking-member:${user_uuid}`}))`;
    }

    private async logContactInteraction(booking: Booking, type: InteractionType, content: string, actor: BookingEventActor) {
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.interaction.create({
                data: {
                    contact_uuid: booking.contact_uuid!,
                    organisation_uuid: booking.organisation_uuid,
                    type,
                    content,
                    metadata: { booking_uuid: booking.uuid, start_at: booking.start_at.toISOString() },
                    created_by_user_uuid: actor.user_uuid ?? null,
                },
            }),
            this.prisma.contact.update({ where: { uuid: booking.contact_uuid! }, data: { last_interaction_at: now } }),
        ]);
    }

    private buildWhere(organisation_uuid: string, query: BookingFiltersDto): Prisma.BookingWhereInput {
        const search = query.search?.trim();
        return {
            organisation_uuid,
            ...((query.from || query.to) && {
                start_at: {
                    ...(query.from && { gte: new Date(query.from) }),
                    ...(query.to && { lt: new Date(query.to) }),
                },
            }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.assigned_user_uuid && {
                assigned_user_uuid: query.assigned_user_uuid === 'unassigned' ? null : query.assigned_user_uuid,
            }),
            ...(query.booking_page_uuid && { booking_page_uuid: query.booking_page_uuid }),
            ...(query.contact_uuid && { contact_uuid: query.contact_uuid }),
            ...(query.source && { source: query.source }),
            ...(search && {
                OR: [
                    { invitee_name: { contains: search, mode: 'insensitive' } },
                    { invitee_email: { contains: search, mode: 'insensitive' } },
                    { invitee_phone: { contains: search } },
                ],
            }),
        };
    }

    private async findBooking(organisation_uuid: string, uuid: string) {
        const booking = await this.prisma.booking.findFirst({ where: { uuid, organisation_uuid } });
        if (!booking) throw new NotFoundException('Booking not found');
        return booking;
    }

    /** Members may change bookings assigned to or created by them; admins any booking. */
    private async findModifiable(actor: BookingActor, uuid: string) {
        const booking = await this.findBooking(actor.organisation_uuid, uuid);
        const own = booking.assigned_user_uuid === actor.uuid || booking.created_by_user_uuid === actor.uuid;
        if (!own && !isOrganisationAdmin(actor)) {
            throw new ForbiddenException('You can only change your own bookings');
        }
        return booking;
    }

    private async findPage(organisation_uuid: string, uuid: string) {
        const page = await this.prisma.bookingPage.findFirst({ where: { uuid, organisation_uuid } });
        if (!page) throw new NotFoundException('Booking page not found');
        return page;
    }

    private async assertOrgMember(organisation_uuid: string, user_uuid: string) {
        const member = await this.prisma.organisationMember.findUnique({
            where: { organisation_uuid_user_uuid: { organisation_uuid, user_uuid } },
            select: { uuid: true },
        });
        if (!member) throw new BadRequestException('That team member is not part of this organisation');
    }

    private async filterAsync<T>(items: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
        const results = await Promise.all(items.map(predicate));
        return items.filter((_, i) => results[i]);
    }

    /** Side effects must never undo or fail an already-committed booking change. */
    private async safely(fn: () => Promise<unknown>, label: string) {
        try {
            await fn();
        } catch (error) {
            this.logger.error(`Booking ${label} failed: ${(error as Error).message}`);
        }
    }

    private emit(user_uuid: string | null, event: string, booking: Booking) {
        if (!user_uuid) return;
        const { manage_token: _secret, ...payload } = booking;
        this.gateway.emitToUser(user_uuid, event, payload);
    }

    /** Persistent in-app alert for the assignee; skipped when they made the change themselves. */
    private async notifyAssignee(booking: Booking, kind: BookingNotificationKind, actor_user_uuid?: string | null) {
        const user_uuid = booking.assigned_user_uuid;
        if (!user_uuid || user_uuid === actor_user_uuid) return;
        const copy = BOOKING_NOTIFICATION_COPY[kind];
        await this.inAppNotifications.notifyUsersSafely([user_uuid], {
            organisation_uuid: booking.organisation_uuid,
            type: copy.type,
            title: `${copy.title}: ${booking.invitee_name}`,
            body: booking.cancellation_reason && kind === 'CANCELLED' ? booking.cancellation_reason : null,
            entity_type: 'booking',
            entity_uuid: booking.uuid,
            data: {
                booking_status: booking.status,
                start_at: booking.start_at.toISOString(),
                end_at: booking.end_at.toISOString(),
                duration_minutes: booking.duration_minutes,
                invitee_name: booking.invitee_name,
                invitee_email: booking.invitee_email,
                invitee_phone: booking.invitee_phone,
                invitee_notes: booking.invitee_notes,
                location_type: booking.location_type,
                location_value: booking.location_value,
                meeting_url: booking.meeting_url,
                contact_uuid: booking.contact_uuid,
            },
        });
    }
}

type BookingNotificationKind = 'CREATED' | 'REQUESTED' | 'RESCHEDULED' | 'CANCELLED' | 'ASSIGNED';

const BOOKING_NOTIFICATION_COPY: Record<BookingNotificationKind, { type: NotificationType; title: string }> = {
    CREATED: { type: NotificationType.BOOKING_CREATED, title: 'New booking' },
    REQUESTED: { type: NotificationType.BOOKING_REQUESTED, title: 'Booking request' },
    RESCHEDULED: { type: NotificationType.BOOKING_RESCHEDULED, title: 'Booking rescheduled' },
    CANCELLED: { type: NotificationType.BOOKING_CANCELLED, title: 'Booking cancelled' },
    ASSIGNED: { type: NotificationType.BOOKING_ASSIGNED, title: 'Booking assigned to you' },
};

function creationSummary(input: PlaceBookingInput): string {
    if (input.source === BookingSource.MANUAL) return 'Booking created by a team member';
    return input.status === BookingStatus.PENDING ? 'Booking requested via booking page' : 'Booked via booking page';
}

function labelForStatus(status: BookingStatus): string {
    return status === BookingStatus.NO_SHOW ? 'no-show' : status.toLowerCase();
}
