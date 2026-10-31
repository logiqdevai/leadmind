import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, UnrecoverableError } from 'bullmq';
import { BookingEventType, BookingLocationType, BookingSource, BookingStatus, CalendarSyncStatus, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BOOKING_CALENDAR_SYNC_QUEUE } from '@/core/queues/queues.constants';
import { GoogleCalendarService } from '@/integrations/composio/services/google-calendar.service';
import { ComposioRequestError } from '@/integrations/composio/interfaces/composio.interface';
import { renderPlaceholders } from '@/shared/utils/placeholder-render.util';
import { CalendarConnectionsService } from './calendar-connections.service';
import { BookingEventsService, SYSTEM_ACTOR } from './booking-events.service';
import { BookingJobNames, CALENDAR_RETAINED_STATUSES, CALENDAR_SYNC_ATTEMPTS, CALENDAR_SYNCED_STATUSES } from '../constants/booking.constants';
import { DEFAULT_CALENDAR_EVENT_DESCRIPTION, DEFAULT_CALENDAR_EVENT_TITLE } from '../constants/booking-email-templates';
import { CalendarSyncJobData } from '../interfaces/booking.interface';
import { buildBookingVars } from '../utils/booking-template-vars.util';

const SYNC_INCLUDE = {
    booking_page: true,
    assigned_user: { select: { full_name: true, email: true } },
    organisation: { select: { name: true, timezone: true } },
    calendar_connection: true,
    contact: { select: { phone: true, notes: true } },
} satisfies Prisma.BookingInclude;

type SyncBooking = Prisma.BookingGetPayload<{ include: typeof SYNC_INCLUDE }>;

/** Google's event id alphabet is base32hex; a uuid without dashes fits, and makes inserts idempotent. */
export const googleEventIdFor = (booking_uuid: string) => `lm${booking_uuid.replace(/-/g, '')}`;

/**
 * Keeps the assigned member's Google Calendar in step with the booking. Always reconciles towards the
 * booking's *current* state, so jobs can be coalesced, retried and replayed safely.
 */
@Injectable()
export class BookingCalendarSyncService {
    private readonly logger = new Logger(BookingCalendarSyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly googleCalendar: GoogleCalendarService,
        private readonly calendarConnections: CalendarConnectionsService,
        private readonly events: BookingEventsService,
        @InjectQueue(BOOKING_CALENDAR_SYNC_QUEUE) private readonly queue: Queue<CalendarSyncJobData>,
    ) {}

    async enqueue(booking: { uuid: string; updated_at: Date }, options: { notify_confirmation_after?: boolean } = {}) {
        await this.prisma.booking.update({
            where: { uuid: booking.uuid },
            data: { calendar_sync_status: CalendarSyncStatus.PENDING },
        });
        await this.queue.add(
            BookingJobNames.SYNC,
            { booking_uuid: booking.uuid, notify_confirmation_after: options.notify_confirmation_after },
            {
                // Distinct per booking version so a change made while a sync runs is never dropped.
                jobId: `booking-sync-${booking.uuid}-${booking.updated_at.getTime()}`,
                attempts: CALENDAR_SYNC_ATTEMPTS,
                backoff: { type: 'exponential', delay: 15_000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 7 * 86400 },
            },
        );
    }

    /** Worker entry point. `is_last_attempt` lets us record the final failure before BullMQ gives up. */
    async process(job: CalendarSyncJobData, is_last_attempt: boolean): Promise<void> {
        const booking = await this.prisma.booking.findUnique({ where: { uuid: job.booking_uuid }, include: SYNC_INCLUDE });
        if (!booking) return;

        // A reminder's placeholder shares the reminder's own Google event, and an imported Google event is owned by
        // Google; syncing either would add a second event or overwrite the original.
        if (booking.source === BookingSource.REMINDER || booking.source === BookingSource.GOOGLE) {
            await this.prisma.booking.update({
                where: { uuid: booking.uuid },
                data: {
                    calendar_sync_status: booking.calendar_connection_uuid ? CalendarSyncStatus.SYNCED : CalendarSyncStatus.NOT_SYNCED,
                },
            });
            return;
        }

        try {
            await this.reconcile(booking);
        } catch (error) {
            const message = (error as Error).message;
            const reconnect = error instanceof ComposioRequestError && error.requires_reconnect;
            if (booking.calendar_connection_uuid) {
                await this.calendarConnections.handleProviderError(booking.calendar_connection_uuid, error);
            }
            if (reconnect || is_last_attempt) {
                await this.markFailed(booking, reconnect ? `Google Calendar needs to be reconnected: ${message}` : message);
                if (reconnect) throw new UnrecoverableError(message);
            }
            throw error;
        }
    }

    private async reconcile(booking: SyncBooking) {
        const target = booking.assigned_user_uuid
            ? await this.calendarConnections.findUsable(booking.organisation_uuid, booking.assigned_user_uuid)
            : null;
        // Finished meetings keep the event they already have (marked with the outcome) and never get a new one.
        const finished = CALENDAR_RETAINED_STATUSES.includes(booking.status);
        const keepsEvent =
            finished &&
            !!booking.calendar_event_id &&
            !!target &&
            booking.calendar_connection?.uuid === target.uuid &&
            booking.calendar_connection.calendar_id === target.calendar_id;
        if (finished && !keepsEvent) return;
        const shouldHaveEvent = CALENDAR_SYNCED_STATUSES.includes(booking.status) || keepsEvent;
        const eventId = booking.calendar_event_id ?? googleEventIdFor(booking.uuid);
        // The connection link is cleared if the connection row goes away; fall back to the member's current one.
        const previous = booking.calendar_connection ?? (!shouldHaveEvent ? target : null);

        // Event lives on a calendar it no longer belongs to (reassigned, cancelled, calendar switched).
        const movedAway =
            booking.calendar_event_id &&
            previous?.composio_connected_account_id &&
            (!shouldHaveEvent || previous.uuid !== target?.uuid || previous.calendar_id !== target?.calendar_id);
        if (movedAway) {
            await this.googleCalendar.deleteEvent(previous.composio_connected_account_id!, previous.calendar_id, booking.calendar_event_id!);
        }

        if (!shouldHaveEvent) {
            await this.prisma.booking.update({
                where: { uuid: booking.uuid },
                data: {
                    calendar_sync_status: booking.calendar_event_id ? CalendarSyncStatus.SYNCED : CalendarSyncStatus.NOT_SYNCED,
                    calendar_event_id: null,
                    calendar_html_link: null,
                    calendar_connection_uuid: null,
                    calendar_sync_error: null,
                    calendar_synced_at: new Date(),
                },
            });
            if (booking.calendar_event_id) {
                await this.events.record(booking, BookingEventType.CALENDAR_SYNCED, SYSTEM_ACTOR, 'Calendar event removed');
            }
            return;
        }

        if (!target) {
            await this.prisma.booking.update({
                where: { uuid: booking.uuid },
                data: {
                    calendar_sync_status: CalendarSyncStatus.NOT_SYNCED,
                    calendar_sync_error: booking.assigned_user_uuid
                        ? 'The assigned team member has no connected Google Calendar'
                        : 'No team member assigned',
                    ...(movedAway && { calendar_event_id: null, calendar_html_link: null, calendar_connection_uuid: null }),
                },
            });
            return;
        }

        const vars = buildBookingVars({
            booking,
            page: booking.booking_page,
            assignee: booking.assigned_user,
            organisation: booking.organisation,
            app_url: this.configService.get<string>('APP_URL') ?? 'http://localhost:5173',
            display_timezone: booking.organisation.timezone,
        });
        const page = booking.booking_page;
        const withMeet = booking.location_type === BookingLocationType.GOOGLE_MEET;
        // Booking internal notes stay out of the event, but the contact's phone and notes are added for the member.
        const contactPhone = booking.contact?.phone && booking.contact.phone !== booking.invitee_phone ? booking.contact.phone : null;
        const description = [
            renderPlaceholders(page?.calendar_event_description || DEFAULT_CALENDAR_EVENT_DESCRIPTION, vars),
            contactPhone ? `Contact phone: ${contactPhone}` : null,
            booking.contact?.notes ? `Contact notes: ${booking.contact.notes}` : null,
        ]
            .filter(Boolean)
            .join('\n\n');

        const result = await this.googleCalendar.upsertEvent(target.composio_connected_account_id, target.calendar_id, eventId, {
            summary: this.outcomePrefix(booking.status) + renderPlaceholders(page?.calendar_event_title || DEFAULT_CALENDAR_EVENT_TITLE, vars),
            description,
            start: booking.start_at,
            end: booking.end_at,
            time_zone: booking.invitee_timezone ?? booking.organisation.timezone,
            location: withMeet ? null : booking.location_value,
            attendees: [{ email: booking.invitee_email, display_name: booking.invitee_name }],
            with_meet: withMeet,
            // Marking a past meeting's outcome shouldn't email the invitee.
            silent: finished,
        });

        const meetMissing = withMeet && !result.meet_url && !booking.meeting_url;
        await this.prisma.booking.update({
            where: { uuid: booking.uuid },
            data: {
                calendar_event_id: result.event_id,
                calendar_html_link: result.html_link,
                calendar_connection_uuid: target.uuid,
                calendar_sync_status: CalendarSyncStatus.SYNCED,
                calendar_sync_error: meetMissing ? 'Google did not return a Meet link for this event' : null,
                calendar_synced_at: new Date(),
                ...(withMeet && result.meet_url && { meeting_url: result.meet_url }),
            },
        });
        await this.events.record(
            booking,
            meetMissing ? BookingEventType.CALENDAR_SYNC_FAILED : BookingEventType.CALENDAR_SYNCED,
            SYSTEM_ACTOR,
            meetMissing ? 'Calendar event saved, but no Google Meet link could be generated' : 'Calendar event saved',
            { calendar_id: target.calendar_id, event_id: result.event_id },
        );
    }

    private outcomePrefix(status: BookingStatus) {
        if (status === BookingStatus.COMPLETED) return '[Completed] ';
        if (status === BookingStatus.NO_SHOW) return '[No-show] ';
        return '';
    }

    private async markFailed(booking: SyncBooking, message: string) {
        this.logger.warn(`Calendar sync failed for booking ${booking.uuid}: ${message}`);
        await this.prisma.booking.update({
            where: { uuid: booking.uuid },
            data: { calendar_sync_status: CalendarSyncStatus.FAILED, calendar_sync_error: message },
        });
        await this.events.record(booking, BookingEventType.CALENDAR_SYNC_FAILED, SYSTEM_ACTOR, 'Calendar sync failed', {
            error: message,
        });
    }
}
