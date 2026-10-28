import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BookingSource, BookingStatus, CalendarConnectionStatus, CalendarProvider, CalendarSyncStatus } from '@/generated/prisma';
import { generateManageToken } from '@/modules/booking-links/utils/booking-url.util';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { GoogleCalendarService } from '@/integrations/composio/services/google-calendar.service';
import { ComposioRequestError } from '@/integrations/composio/interfaces/composio.interface';

const EVENT_DURATION_MS = 15 * 60 * 1000;

interface ReminderEventSource {
    uuid: string;
    title: string | null;
    notes: string | null;
    remind_at: Date;
    calendar_event_id: string | null;
    calendar_connection_uuid: string | null;
    contact: { name: string | null; company: string | null };
}

/** Google's event id alphabet is base32hex; a uuid without dashes fits, and makes inserts idempotent. */
const googleEventIdFor = (reminder_uuid: string) => `lr${reminder_uuid.replace(/-/g, '')}`;

/** Mirrors a reminder onto the creating member's Google Calendar (best effort, never blocks the reminder). */
@Injectable()
export class ReminderCalendarService {
    private readonly logger = new Logger(ReminderCalendarService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly googleCalendar: GoogleCalendarService,
    ) {}

    /** Fails fast, before anything is saved, when the member has no usable Google Calendar. */
    async requireConnection(organisation_uuid: string, user_uuid: string) {
        const connection = await this.prisma.calendarConnection.findUnique({
            where: {
                organisation_uuid_user_uuid_provider: { organisation_uuid, user_uuid, provider: CalendarProvider.GOOGLE },
            },
        });
        if (!connection?.composio_connected_account_id || connection.status !== CalendarConnectionStatus.ACTIVE) {
            throw new BadRequestException('Connect your Google Calendar first to add reminders to it');
        }
        return connection as typeof connection & { composio_connected_account_id: string };
    }

    /** Creates or updates the event. Returns whether it ended up on the calendar. */
    async upsert(reminder: ReminderEventSource, connection_uuid: string): Promise<boolean> {
        const connection = await this.prisma.calendarConnection.findUnique({ where: { uuid: connection_uuid } });
        if (!connection?.composio_connected_account_id || connection.status !== CalendarConnectionStatus.ACTIVE) {
            return false;
        }
        const org = await this.prisma.reminder.findUnique({
            where: { uuid: reminder.uuid },
            select: {
                organisation_uuid: true,
                contact: { select: { uuid: true, email: true } },
                organisation: { select: { timezone: true } },
            },
        });
        const eventId = reminder.calendar_event_id ?? googleEventIdFor(reminder.uuid);
        const who = reminder.contact.name ?? reminder.contact.company;
        const summary = `Reminder: ${reminder.title?.trim() || (who ? `Follow up with ${who}` : 'Follow up')}`;
        const description = [who ? `Contact: ${who}` : null, reminder.notes].filter(Boolean).join('\n\n');

        try {
            const result = await this.googleCalendar.upsertEvent(
                connection.composio_connected_account_id,
                connection.calendar_id,
                eventId,
                {
                    summary,
                    description,
                    start: reminder.remind_at,
                    end: new Date(reminder.remind_at.getTime() + EVENT_DURATION_MS),
                    time_zone: org?.organisation.timezone ?? 'UTC',
                    attendees: [],
                    with_meet: false,
                    silent: true,
                    free: true,
                },
            );
            await this.prisma.reminder.update({
                where: { uuid: reminder.uuid },
                data: { calendar_event_id: result.event_id, calendar_connection_uuid: connection.uuid },
            });
            if (org) {
                await this.syncPlaceholderBooking(reminder, summary, connection, org, result.html_link).catch((error) =>
                    this.logger.warn(`Could not hold calendar time for reminder ${reminder.uuid}: ${(error as Error).message}`),
                );
            }
            return true;
        } catch (error) {
            await this.handleError(connection.uuid, error, `add reminder ${reminder.uuid}`);
            return false;
        }
    }

    /**
     * Keeps an empty booking (source REMINDER, no invitee) on our calendar for the reminder's slot.
     * It deliberately has no calendar_event_id: the reminder owns the Google event, and the inbound
     * Google sync matches bookings by that id. It is marked as already synced (and the booking calendar
     * sync skips REMINDER bookings), so it never creates a second event for the same slot.
     */
    private async syncPlaceholderBooking(
        reminder: ReminderEventSource,
        title: string,
        connection: { uuid: string; user_uuid: string },
        org: { organisation_uuid: string; contact: { uuid: string; email: string | null } },
        html_link: string | null,
    ) {
        const start_at = reminder.remind_at;
        const end_at = new Date(start_at.getTime() + EVENT_DURATION_MS);
        const fields = {
            start_at,
            end_at,
            duration_minutes: EVENT_DURATION_MS / 60_000,
            invitee_name: title,
            internal_notes: reminder.notes,
            calendar_connection_uuid: connection.uuid,
            calendar_html_link: html_link,
            calendar_sync_status: CalendarSyncStatus.SYNCED,
            calendar_sync_error: null,
            calendar_synced_at: new Date(),
        };
        await this.prisma.booking.upsert({
            where: { source_reminder_uuid: reminder.uuid },
            update: fields,
            create: {
                ...fields,
                organisation_uuid: org.organisation_uuid,
                source_reminder_uuid: reminder.uuid,
                source: BookingSource.REMINDER,
                status: BookingStatus.CONFIRMED,
                confirmed_at: new Date(),
                contact_uuid: org.contact.uuid,
                assigned_user_uuid: connection.user_uuid,
                created_by_user_uuid: connection.user_uuid,
                invitee_email: org.contact.email ?? '',
                manage_token: generateManageToken(),
            },
        });
    }

    /**
     * Removes the event and placeholder booking (if any) and forgets them on the reminder.
     * `keep_connection` leaves calendar_connection_uuid behind, so reopening a completed or cancelled
     * reminder knows to put it back on that calendar.
     */
    async remove(
        reminder: { uuid: string; calendar_event_id: string | null; calendar_connection_uuid: string | null },
        opts?: { keep_connection?: boolean },
    ) {
        await this.prisma.booking
            .deleteMany({ where: { source_reminder_uuid: reminder.uuid } })
            .catch(() => undefined);
        if (reminder.calendar_event_id && reminder.calendar_connection_uuid) {
            const connection = await this.prisma.calendarConnection.findUnique({
                where: { uuid: reminder.calendar_connection_uuid },
            });
            if (connection?.composio_connected_account_id) {
                try {
                    await this.googleCalendar.deleteEvent(
                        connection.composio_connected_account_id,
                        connection.calendar_id,
                        reminder.calendar_event_id,
                    );
                } catch (error) {
                    await this.handleError(connection.uuid, error, `remove reminder ${reminder.uuid}`);
                }
            }
        }
        await this.prisma.reminder
            .update({
                where: { uuid: reminder.uuid },
                data: {
                    calendar_event_id: null,
                    ...(!opts?.keep_connection && { calendar_connection_uuid: null }),
                },
            })
            .catch(() => undefined); // reminder may already be deleted
    }

    private async handleError(connection_uuid: string, error: unknown, action: string) {
        this.logger.warn(`Google Calendar: could not ${action}: ${(error as Error).message}`);
        if (error instanceof ComposioRequestError && error.requires_reconnect) {
            await this.prisma.calendarConnection.update({
                where: { uuid: connection_uuid },
                data: { status: CalendarConnectionStatus.EXPIRED, last_error: error.message },
            });
        }
    }
}
