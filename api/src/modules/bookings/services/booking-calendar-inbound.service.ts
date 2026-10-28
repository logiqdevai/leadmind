import { randomBytes, randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Booking, BookingEventType, BookingLocationType, CalendarConnection, CalendarConnectionStatus, CalendarSyncStatus } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BOOKING_CALENDAR_SYNC_QUEUE } from '@/core/queues/queues.constants';
import { GoogleCalendarService } from '@/integrations/composio/services/google-calendar.service';
import { GoogleChangedEvent } from '@/integrations/composio/interfaces/google-calendar.interface';
import { BookingsService } from '../bookings.service';
import { CalendarConnectionsService } from './calendar-connections.service';
import { BookingEventsService, SYSTEM_ACTOR } from './booking-events.service';
import {
    ACTIVE_BOOKING_STATUSES,
    BookingJobNames,
    CALENDAR_ECHO_TOLERANCE_MS,
    CALENDAR_INITIAL_LOOKBACK_MS,
    CALENDAR_PULL_INTERVAL_MS,
    CALENDAR_WATCH_RENEW_BEFORE_MS,
} from '../constants/booking.constants';
import { CalendarPullJobData } from '../interfaces/booking.interface';

const PULL_JOB_ID = 'booking-calendar-pull';

/**
 * Google -> app half of the calendar sync.
 *
 * Google pushes a notification to our webhook whenever a connected calendar changes (instant), and a
 * repeating job polls as a safety net and renews the push channels. Both run the same incremental pull:
 * a per-connection sync token makes Google return exactly the changes since last time, so even a long
 * outage loses nothing. Edits we made ourselves are recognised by timestamp (`isEcho`) so the two
 * directions never ping-pong.
 */
@Injectable()
export class BookingCalendarInboundService {
    private readonly logger = new Logger(BookingCalendarInboundService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly googleCalendar: GoogleCalendarService,
        private readonly calendarConnections: CalendarConnectionsService,
        private readonly bookings: BookingsService,
        private readonly events: BookingEventsService,
        @InjectQueue(BOOKING_CALENDAR_SYNC_QUEUE) private readonly queue: Queue,
    ) {}

    /** Idempotent: BullMQ dedupes a repeatable job with the same jobId + repeat config. */
    async schedule() {
        await this.queue.add(
            BookingJobNames.PULL,
            {},
            { jobId: PULL_JOB_ID, repeat: { every: CALENDAR_PULL_INTERVAL_MS }, removeOnComplete: 10, removeOnFail: 10 },
        );
    }

    /**
     * Google only accepts a public HTTPS address, so push is skipped (polling only) on localhost or plain http.
     */
    private webhookAddress(): string | null {
        const base = this.configService.get<string>('API_URL')?.replace(/\/+$/, '');
        if (!base || !base.startsWith('https://')) return null;
        return `${base}/public/calendar/google-webhook`;
    }

    /** Webhook entry: validates the channel and queues a pull for that connection. */
    async handleNotification(channel_id: string | undefined, token: string | undefined, resource_state: string | undefined) {
        if (!channel_id || !token) return;
        const connection = await this.prisma.calendarConnection.findUnique({ where: { watch_channel_id: channel_id } });
        if (!connection || connection.watch_token !== token) return;
        // "sync" is Google's handshake when the channel is created; there is nothing to pull yet.
        if (resource_state === 'sync') return;
        await this.queue.add(
            BookingJobNames.PULL,
            { connection_uuid: connection.uuid } satisfies CalendarPullJobData,
            // A few seconds of coalescing: Google often sends a burst for one edit.
            { delay: 2_000, jobId: `pull-${connection.uuid}-${Math.floor(Date.now() / 5_000)}`, removeOnComplete: true, removeOnFail: 50 },
        );
    }

    async run(job: CalendarPullJobData) {
        if (job.connection_uuid) {
            const connection = await this.prisma.calendarConnection.findUnique({ where: { uuid: job.connection_uuid } });
            if (connection) await this.pullSafely(connection);
            return;
        }
        const connections = await this.prisma.calendarConnection.findMany({
            where: { status: CalendarConnectionStatus.ACTIVE, composio_connected_account_id: { not: null } },
        });
        for (const connection of connections) {
            await this.ensureWatch(connection);
            await this.pullSafely(connection);
        }
    }

    private async pullSafely(connection: CalendarConnection) {
        try {
            await this.pull(connection);
        } catch (error) {
            await this.calendarConnections.handleProviderError(connection.uuid, error);
            this.logger.warn(`Calendar pull failed for connection ${connection.uuid}: ${(error as Error).message}`);
        }
    }

    private async pull(connection: CalendarConnection) {
        if (connection.status !== CalendarConnectionStatus.ACTIVE || !connection.composio_connected_account_id) return;
        const account = connection.composio_connected_account_id;
        const since = new Date(Date.now() - CALENDAR_INITIAL_LOOKBACK_MS);

        let result = await this.googleCalendar.listChangedEvents(account, connection.calendar_id, { sync_token: connection.sync_token, since });
        if (result.token_expired) {
            result = await this.googleCalendar.listChangedEvents(account, connection.calendar_id, { since });
        }

        const bookings = result.events.length
            ? await this.prisma.booking.findMany({
                  where: {
                      calendar_connection_uuid: connection.uuid,
                      calendar_event_id: { in: result.events.map((e) => e.id) },
                      status: { in: ACTIVE_BOOKING_STATUSES },
                  },
              })
            : [];
        const byEventId = new Map(bookings.map((b) => [b.calendar_event_id!, b]));

        let allApplied = true;
        for (const event of result.events) {
            const booking = byEventId.get(event.id);
            if (!booking || this.isEcho(booking, event)) continue;
            try {
                await this.apply(booking.uuid, event);
            } catch (error) {
                allApplied = false;
                this.logger.warn(`Could not apply Google change to booking ${booking.uuid}: ${(error as Error).message}`);
            }
        }

        // Only advance the cursor once everything was applied, so a failed change is retried next time.
        if (allApplied && result.next_sync_token && result.next_sync_token !== connection.sync_token) {
            await this.prisma.calendarConnection.update({ where: { uuid: connection.uuid }, data: { sync_token: result.next_sync_token } });
        }
    }

    /** Our own write (or one still in flight) shows up in Google as a change too; those must not be applied back. */
    private isEcho(booking: { calendar_sync_status: CalendarSyncStatus; calendar_synced_at: Date | null }, event: GoogleChangedEvent) {
        if (booking.calendar_sync_status !== CalendarSyncStatus.SYNCED || !booking.calendar_synced_at || !event.updated) return true;
        return event.updated.getTime() <= booking.calendar_synced_at.getTime() + CALENDAR_ECHO_TOLERANCE_MS;
    }

    private async apply(booking_uuid: string, event: GoogleChangedEvent) {
        // Re-read: the booking may have changed since the batch was loaded.
        let booking = await this.prisma.booking.findUnique({ where: { uuid: booking_uuid } });
        if (!booking || !ACTIVE_BOOKING_STATUSES.includes(booking.status)) return;

        if (event.cancelled) {
            await this.bookings.cancelBooking(booking, {
                reason: 'Event was deleted from Google Calendar',
                notify: true,
                actor: SYSTEM_ACTOR,
            });
            return;
        }

        // Details first (they don't touch the schedule), then the time move, which re-reads availability and notifies.
        booking = await this.applyDetails(booking, event);
        await this.applyTime(booking, event);
    }

    /** Location and invitee edits made in Google. Title/description are generated from templates, so they aren't pulled. */
    private async applyDetails(booking: Booking, event: GoogleChangedEvent): Promise<Booking> {
        const data: Partial<Booking> = {};
        const changes: Record<string, unknown> = {};

        if (booking.location_type !== BookingLocationType.GOOGLE_MEET) {
            const location = event.location?.trim() || null;
            if (location !== (booking.location_value ?? null)) {
                data.location_value = location;
                // A location typed into an event that had none needs a type to be shown anywhere.
                if (location && booking.location_type === BookingLocationType.NONE) data.location_type = BookingLocationType.CUSTOM;
                if (!location) data.location_type = BookingLocationType.NONE;
                changes.location = { from: booking.location_value, to: location };
            }
        }

        const guests = event.attendees.filter((a) => !a.is_organizer);
        const invitee = guests.find((a) => a.email === booking.invitee_email.toLowerCase());
        // The invitee was swapped for someone else: the single remaining guest is the new invitee.
        if (!invitee && guests.length === 1) {
            data.invitee_email = guests[0].email;
            if (guests[0].display_name) data.invitee_name = guests[0].display_name;
            changes.invitee = { from: booking.invitee_email, to: guests[0].email };
        }

        if (Object.keys(data).length) {
            booking = await this.prisma.booking.update({ where: { uuid: booking.uuid }, data });
            await this.events.record(booking, BookingEventType.UPDATED, SYSTEM_ACTOR, 'Booking updated from Google Calendar', changes);
        }
        if (invitee?.response_status === 'declined') {
            await this.events.record(booking, BookingEventType.UPDATED, SYSTEM_ACTOR, 'Invitee declined the invitation in Google Calendar', {
                invitee: invitee.email,
            });
        }
        return booking;
    }

    private async applyTime(booking: Booking, event: GoogleChangedEvent) {
        if (!event.start || !event.end) return;
        const duration = Math.round((event.end.getTime() - event.start.getTime()) / 60_000);
        if (duration <= 0) return;
        if (event.start.getTime() === booking.start_at.getTime() && duration === booking.duration_minutes) return;

        const current =
            duration === booking.duration_minutes
                ? booking
                : await this.prisma.booking.update({ where: { uuid: booking.uuid }, data: { duration_minutes: duration } });
        // Google is the source of truth for this edit, so availability rules don't veto it.
        await this.bookings.moveBooking(current, event.start, { ignore_availability: true, notify: true, actor: SYSTEM_ACTOR });
    }

    // --- Push channel lifecycle ---

    /** Creates the push channel, or renews it shortly before it expires. No-op without a public API URL. */
    async ensureWatch(connection: CalendarConnection) {
        const address = this.webhookAddress();
        if (!address || !connection.composio_connected_account_id) return;
        const fresh =
            connection.watch_channel_id &&
            connection.watch_expires_at &&
            connection.watch_expires_at.getTime() - Date.now() > CALENDAR_WATCH_RENEW_BEFORE_MS;
        if (fresh) return;

        try {
            const channel = { id: randomUUID(), token: randomBytes(24).toString('hex'), address };
            const watch = await this.googleCalendar.watchEvents(connection.composio_connected_account_id, connection.calendar_id, channel);
            await this.prisma.calendarConnection.update({
                where: { uuid: connection.uuid },
                data: { watch_channel_id: channel.id, watch_resource_id: watch.resource_id, watch_token: channel.token, watch_expires_at: watch.expires_at },
            });
            // Retire the previous channel only after the new one exists, so there is no gap.
            if (connection.watch_channel_id && connection.watch_resource_id) {
                await this.googleCalendar
                    .stopWatch(connection.composio_connected_account_id, connection.watch_channel_id, connection.watch_resource_id)
                    .catch(() => undefined);
            }
        } catch (error) {
            this.logger.warn(`Could not open Google push channel for ${connection.uuid}: ${(error as Error).message}`);
        }
    }
}
