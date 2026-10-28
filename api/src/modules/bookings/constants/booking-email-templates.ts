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

const manageLinks = `<p>Need a different time? No problem - you can <a href="{{booking.reschedule_url}}">reschedule</a> or <a href="{{booking.cancel_url}}">cancel</a> anytime.</p>`;

/** The default sender profile's signature; the notification service falls back to the team member + brand when it is empty. */
const signOff = '{{signature}}';

/** Invitee-facing defaults, used when a booking page has no template selected for that email. */
export const DEFAULT_INVITEE_TEMPLATES: Record<BookingNotificationKind, BookingEmailTemplate> = {
    CONFIRMATION: {
        subject: "You're all set: {{booking.title}} on {{booking.date}}",
        html: `<p>Hi {{contact.first_name}},</p><p>Thanks for booking a call with us - we're really looking forward to speaking with you! Here are the details:</p>${details}<p>Your meeting link is just below, and you can add the call to your calendar with one click.</p>${manageLinks}<p>See you soon!</p>${signOff}`,
    },
    REMINDER: {
        subject: 'See you soon: {{booking.title}} on {{booking.date}} at {{booking.start_time}}',
        html: `<p>Hi {{contact.first_name}},</p><p>Just a friendly reminder about our upcoming call. Here's what's coming up:</p>${details}<p>Your meeting link is just below.</p>${manageLinks}<p>Talk soon!</p>${signOff}`,
    },
    CANCELLATION: {
        subject: 'Your meeting on {{booking.date}} has been cancelled',
        html: `<p>Hi {{contact.first_name}},</p><p>Your meeting on {{booking.date}} at {{booking.start_time}} has been cancelled.</p><p>If you'd still like to talk, you can pick a new time whenever it suits you - or just reply to this email and we'll find one together.</p>{{booking.book_again_link}}<p>Hope to speak soon!</p>${signOff}`,
    },
    RESCHEDULE: {
        subject: 'New time for {{booking.title}}: {{booking.date}} at {{booking.start_time}}',
        html: `<p>Hi {{contact.first_name}},</p><p>Your meeting has been moved to a new time. Here are the updated details:</p>${details}<p>Your meeting link is just below.</p>${manageLinks}<p>See you then!</p>${signOff}`,
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
    'Name: {{contact.full_name}}',
    'Email: {{contact.email}}',
    'Phone: {{contact.phone}}',
    'Duration: {{booking.duration}}',
    '',
    'Notes: {{booking.notes}}',
].join('\n');
