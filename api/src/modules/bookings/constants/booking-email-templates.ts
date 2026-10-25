import { BookingNotificationKind } from '@/generated/prisma';

export interface BookingEmailTemplate {
    subject: string;
    html: string;
}

const details = `
<table cellpadding="0" cellspacing="0" border="0"><tbody>
<tr><td style="padding:2px 12px 2px 0;color:#6b7280">What</td><td>{{booking.title}}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#6b7280">When</td><td>{{booking.date}}, {{booking.time}}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#6b7280">Duration</td><td>{{booking.duration}}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#6b7280">With</td><td>{{team_member.name}}</td></tr>
</tbody></table>`;

const manageLinks = `<p><a href="{{booking.reschedule_url}}">Reschedule</a> &middot; <a href="{{booking.cancel_url}}">Cancel</a></p>`;

/** Invitee-facing defaults, used when a booking page has no template selected for that email. */
export const DEFAULT_INVITEE_TEMPLATES: Record<BookingNotificationKind, BookingEmailTemplate> = {
    CONFIRMATION: {
        subject: 'Confirmed: {{booking.title}} on {{booking.date}}',
        html: `<p>Hi {{contact.first_name}},</p><p>Your meeting is booked.</p>${details}${manageLinks}<p>{{organisation.name}}</p>`,
    },
    REMINDER: {
        subject: 'Reminder: {{booking.title}} on {{booking.date}} at {{booking.start_time}}',
        html: `<p>Hi {{contact.first_name}},</p><p>This is a reminder of your upcoming meeting.</p>${details}${manageLinks}<p>{{organisation.name}}</p>`,
    },
    CANCELLATION: {
        subject: 'Cancelled: {{booking.title}} on {{booking.date}}',
        html: `<p>Hi {{contact.first_name}},</p><p>Your meeting on {{booking.date}} at {{booking.start_time}} has been cancelled.</p><p>{{organisation.name}}</p>`,
    },
    RESCHEDULE: {
        subject: 'Rescheduled: {{booking.title}} is now on {{booking.date}}',
        html: `<p>Hi {{contact.first_name}},</p><p>Your meeting has been moved to a new time.</p>${details}${manageLinks}<p>{{organisation.name}}</p>`,
    },
};

/** Sent to the assigned member and any additional internal recipients. */
export const DEFAULT_INTERNAL_TEMPLATES: Record<BookingNotificationKind, BookingEmailTemplate> = {
    CONFIRMATION: {
        subject: 'New booking: {{contact.full_name}} - {{booking.date}} {{booking.start_time}}',
        html: `<p>{{contact.full_name}} ({{contact.email}}) booked a meeting.</p>${details}<p>Phone: {{contact.phone}}</p><p>Notes: {{booking.notes}}</p>`,
    },
    REMINDER: {
        subject: 'Upcoming: {{contact.full_name}} - {{booking.date}} {{booking.start_time}}',
        html: `<p>Upcoming meeting with {{contact.full_name}} ({{contact.email}}).</p>${details}<p>Notes: {{booking.notes}}</p>`,
    },
    CANCELLATION: {
        subject: 'Cancelled: {{contact.full_name}} - {{booking.date}} {{booking.start_time}}',
        html: `<p>The meeting with {{contact.full_name}} ({{contact.email}}) was cancelled.</p>${details}<p>Reason: {{booking.cancellation_reason}}</p>`,
    },
    RESCHEDULE: {
        subject: 'Rescheduled: {{contact.full_name}} - now {{booking.date}} {{booking.start_time}}',
        html: `<p>The meeting with {{contact.full_name}} ({{contact.email}}) moved to a new time.</p>${details}`,
    },
};

export const DEFAULT_CALENDAR_EVENT_TITLE = '{{booking.title}} with {{contact.full_name}}';

export const DEFAULT_CALENDAR_EVENT_DESCRIPTION = [
    'Booked via {{organisation.name}}',
    '',
    'Name: {{contact.full_name}}',
    'Email: {{contact.email}}',
    'Phone: {{contact.phone}}',
    'Duration: {{booking.duration}}',
    '',
    'Notes: {{booking.notes}}',
].join('\n');
