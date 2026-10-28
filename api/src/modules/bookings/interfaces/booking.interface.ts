import { OrganisationRole } from '@/generated/prisma';

/** The authenticated team member acting on booking resources (JWT payload subset). */
export interface BookingActor {
    uuid: string;
    organisation_uuid: string;
    organisation_role?: OrganisationRole | string;
}

export const isOrganisationAdmin = (actor: BookingActor) =>
    actor.organisation_role === OrganisationRole.OWNER || actor.organisation_role === OrganisationRole.ADMIN;

export interface SlotsByDate {
    timezone: string;
    duration_minutes: number;
    /** Local date (in `timezone`) -> slot start/end instants. */
    days: Record<string, { start: string; end: string; available: boolean; user_uuids?: string[] }[]>;
}

export interface CalendarSyncJobData {
    booking_uuid: string;
    /** Send the confirmation email after syncing, so it can include the generated Meet link. */
    notify_confirmation_after?: boolean;
}

export interface BookingNotificationJobData {
    booking_uuid: string;
    kind: 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'RESCHEDULE';
    /** Reminders: minutes before start; the job is skipped if the booking moved since it was queued. */
    offset_minutes?: number;
    scheduled_for_start?: string;
}

/** Delayed follow-up for an emailed booking link: fires only if the contact still has not booked. */
export interface BookingInviteReminderJobData {
    invitation_uuid: string;
    /** 1-based index of the reminder this job sends. */
    reminder_number: number;
}
