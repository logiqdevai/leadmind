import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Prisma, ReminderSource, ReminderStatus, ReminderType } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RemindersService } from '@/modules/reminders/reminders.service';
import { CALENDAR_SYNCED_STATUSES } from '../constants/booking.constants';
import { describeLocation, formatDuration } from '../utils/booking-template-vars.util';

/** What just happened to the booking; decides whether a finished reminder may be re-created. */
export type TeamReminderReason = 'created' | 'confirmed' | 'rescheduled' | 'updated' | 'cancelled' | 'status';

const REMINDER_BOOKING_KEY = 'booking_uuid';
/** A reminder due "now" is pushed this far out: the reminders API only accepts future times. */
const MIN_LEAD_MS = 60_000;

const SYNC_INCLUDE = {
    booking_page: { select: { name: true, create_team_reminder: true, team_reminder_offset_minutes: true } },
    assigned_user: { select: { full_name: true, email: true, memberships: { select: { organisation_uuid: true } } } },
    organisation: { select: { timezone: true } },
    reminder: true,
} satisfies Prisma.BookingInclude;

type SyncBooking = Prisma.BookingGetPayload<{ include: typeof SYNC_INCLUDE }>;

/**
 * Optional (per booking page) reminder: a Meeting reminder on the contact's Reminders, assigned to the member
 * who has the meeting. Reconciled towards the booking's current state after every change.
 */
@Injectable()
export class BookingTeamReminderService {
    private readonly logger = new Logger(BookingTeamReminderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly reminders: RemindersService,
    ) {}

    async sync(booking_uuid: string, reason: TeamReminderReason): Promise<void> {
        const booking = await this.prisma.booking.findUnique({ where: { uuid: booking_uuid }, include: SYNC_INCLUDE });
        if (!booking) return;

        const now = Date.now();
        const wanted =
            !!booking.contact_uuid &&
            !!booking.booking_page?.create_team_reminder &&
            CALENDAR_SYNCED_STATUSES.includes(booking.status) &&
            booking.start_at.getTime() > now;

        const existing = booking.reminder;
        const pending = existing?.status === ReminderStatus.PENDING ? existing : null;

        if (!wanted) {
            // Cancelled, completed, no-show, moved back to pending, setting turned off, or already started.
            if (pending) await this.reminders.update(booking.organisation_uuid, pending.uuid, { status: ReminderStatus.CANCELLED });
            return;
        }

        const offsetMs = booking.booking_page!.team_reminder_offset_minutes * 60_000;
        const remindAtMs = Math.max(booking.start_at.getTime() - offsetMs, now + MIN_LEAD_MS);
        // Starting within a minute: a reminder would arrive after the meeting began.
        if (remindAtMs >= booking.start_at.getTime()) return;
        const remindAt = new Date(remindAtMs);

        const text = this.describe(booking);
        const assignees = this.assigneesOf(booking);
        if (pending) {
            // Only a real time change moves the due date. Edits that don't touch the time must not re-fire a
            // reminder that has already come due (it stays PENDING until someone completes it).
            const timeChanged = reason === 'rescheduled' || reason === 'confirmed' || reason === 'created';
            await this.reminders.update(booking.organisation_uuid, pending.uuid, {
                title: text.title,
                notes: text.notes,
                // Follows the booking when it is reassigned.
                assignee_user_uuids: assignees,
                ...(timeChanged && { remind_at: remindAt.toISOString() }),
            });
            return;
        }

        // None yet, or the previous one was completed/cancelled/deleted by someone. Only a new or moved meeting
        // earns a new reminder; a plain edit doesn't resurrect one the team already dealt with.
        if (reason === 'updated' || reason === 'status') return;
        await this.createFor(booking, remindAt, text, assignees);
    }

    /**
     * Only the member who has the meeting is reminded. With nobody assigned (or the assignee gone from the
     * organisation) the list is empty, which the reminders feature treats as "every member".
     */
    private assigneesOf(booking: SyncBooking): string[] {
        const assignee = booking.assigned_user;
        const stillMember = assignee?.memberships.some((m) => m.organisation_uuid === booking.organisation_uuid);
        return booking.assigned_user_uuid && stillMember ? [booking.assigned_user_uuid] : [];
    }

    /**
     * Deletes the contact's reminder behind a REMINDER placeholder booking, along with its Google event and the
     * booking itself. Used when the booking is removed or cancelled from the app.
     */
    async deleteSourceReminder(organisation_uuid: string, reminder_uuid: string): Promise<void> {
        try {
            await this.reminders.remove(organisation_uuid, reminder_uuid);
        } catch (error) {
            if (!(error instanceof NotFoundException)) throw error;
        }
    }

    /** Never lets a reminder problem affect the booking itself. */
    async syncSafely(booking_uuid: string, reason: TeamReminderReason): Promise<void> {
        try {
            await this.sync(booking_uuid, reason);
        } catch (error) {
            this.logger.error(`Team reminder sync failed for booking ${booking_uuid}: ${(error as Error).message}`);
        }
    }

    private async createFor(booking: SyncBooking, remindAt: Date, text: { title: string; notes: string }, assignees: string[]) {
        const reminder = await this.reminders.create(
            booking.organisation_uuid,
            {
                contact_uuid: booking.contact_uuid!,
                title: text.title,
                notes: text.notes,
                remind_at: remindAt.toISOString(),
                assignee_user_uuids: assignees,
            },
            {
                source: ReminderSource.SYSTEM,
                type: ReminderType.MEETING,
                metadata: { [REMINDER_BOOKING_KEY]: booking.uuid },
            },
        );
        await this.prisma.booking.update({ where: { uuid: booking.uuid }, data: { reminder_uuid: reminder.uuid } });
    }

    private describe(booking: SyncBooking): { title: string; notes: string } {
        const zone = booking.organisation.timezone || 'UTC';
        const start = DateTime.fromJSDate(booking.start_at, { zone });
        const lines = [
            `${start.toFormat('cccc, d LLLL yyyy, HH:mm')} (${zone}) - ${formatDuration(booking.duration_minutes)}`,
            booking.assigned_user ? `With ${booking.assigned_user.full_name || booking.assigned_user.email}` : null,
            describeLocation(booking.location_type, booking.location_value, booking.meeting_url) || null,
            booking.invitee_notes ? `Notes: ${booking.invitee_notes}` : null,
        ];
        const label = booking.booking_page?.name ? ` - ${booking.booking_page.name}` : '';
        return { title: `Meeting with ${booking.invitee_name}${label}`.slice(0, 200), notes: lines.filter(Boolean).join('\n') };
    }
}
