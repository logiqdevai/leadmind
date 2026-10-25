import { DateTime } from 'luxon';
import { BookingLocationType } from '@/generated/prisma';
import type { PlaceholderVars } from '@/shared/utils/placeholder-render.util';
import { BookingPublicUrls } from '@/modules/booking-links/utils/booking-url.util';

export interface BookingVarsInput {
    booking: {
        start_at: Date;
        end_at: Date;
        duration_minutes: number;
        invitee_name: string;
        invitee_email: string;
        invitee_phone: string | null;
        invitee_notes: string | null;
        invitee_timezone: string | null;
        location_type: BookingLocationType;
        location_value: string | null;
        meeting_url: string | null;
        manage_token: string;
        status: string;
        cancellation_reason?: string | null;
    };
    page: { name: string; title: string | null } | null;
    assignee: { full_name: string | null; email: string } | null;
    organisation: { name: string; timezone: string };
    app_url: string;
    /** Timezone the times are written in; defaults to the invitee's, then the organisation's. */
    display_timezone?: string;
}

/** Variables documented in the booking notification UI (`{{contact.first_name}}`, `{{booking.date}}`...). */
export const BOOKING_TEMPLATE_VARIABLES = [
    'contact.first_name',
    'contact.last_name',
    'contact.full_name',
    'contact.email',
    'contact.phone',
    'booking.title',
    'booking.date',
    'booking.time',
    'booking.start_time',
    'booking.end_time',
    'booking.timezone',
    'booking.duration',
    'booking.location',
    'booking.meeting_url',
    'booking.reschedule_url',
    'booking.cancel_url',
    'booking.manage_url',
    'booking.notes',
    'booking.cancellation_reason',
    'team_member.name',
    'team_member.email',
    'organisation.name',
] as const;

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const h = `${hours} hour${hours > 1 ? 's' : ''}`;
    return rest ? `${h} ${rest} minutes` : h;
}

export function describeLocation(type: BookingLocationType, value: string | null, meeting_url: string | null): string {
    switch (type) {
        case BookingLocationType.GOOGLE_MEET:
            return meeting_url ? `Google Meet (${meeting_url})` : 'Google Meet (link to follow)';
        case BookingLocationType.PHONE:
            return value ? `Phone call (${value})` : 'Phone call';
        case BookingLocationType.IN_PERSON:
            return value ? `In person - ${value}` : 'In person';
        case BookingLocationType.CUSTOM:
            return value ?? '';
        default:
            return '';
    }
}

export function buildBookingVars(input: BookingVarsInput): PlaceholderVars {
    const { booking, page, assignee, organisation, app_url } = input;
    const zone = input.display_timezone ?? booking.invitee_timezone ?? organisation.timezone ?? 'UTC';
    const start = DateTime.fromJSDate(booking.start_at, { zone });
    const end = DateTime.fromJSDate(booking.end_at, { zone });
    const nameParts = booking.invitee_name.trim().split(/\s+/).filter(Boolean);

    return {
        'contact.first_name': nameParts[0] ?? '',
        'contact.last_name': nameParts.slice(1).join(' '),
        'contact.full_name': booking.invitee_name,
        'contact.email': booking.invitee_email,
        'contact.phone': booking.invitee_phone ?? '',
        'booking.title': page?.title || page?.name || 'Meeting',
        'booking.date': start.toFormat('cccc, d LLLL yyyy'),
        'booking.time': `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')} (${zone})`,
        'booking.start_time': start.toFormat('HH:mm'),
        'booking.end_time': end.toFormat('HH:mm'),
        'booking.timezone': zone,
        'booking.duration': formatDuration(booking.duration_minutes),
        'booking.location': describeLocation(booking.location_type, booking.location_value, booking.meeting_url),
        'booking.meeting_url': booking.meeting_url ?? '',
        'booking.reschedule_url': BookingPublicUrls.reschedule(app_url, booking.manage_token),
        'booking.cancel_url': BookingPublicUrls.cancel(app_url, booking.manage_token),
        'booking.manage_url': BookingPublicUrls.manage(app_url, booking.manage_token),
        'booking.notes': booking.invitee_notes ?? '',
        'booking.cancellation_reason': booking.cancellation_reason ?? '',
        'team_member.name': assignee?.full_name || assignee?.email || organisation.name,
        'team_member.email': assignee?.email ?? '',
        'organisation.name': organisation.name,
    };
}

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Same variables, HTML-escaped - for email bodies, where invitee-typed values must not inject markup. */
export function escapeVars(vars: PlaceholderVars): PlaceholderVars {
    return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, escapeHtml(v)]));
}

/** "Add to Google Calendar" template link for the invitee (no account needed). */
export function googleCalendarTemplateUrl(title: string, start: Date, end: Date, details: string, location: string): string {
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${fmt(start)}/${fmt(end)}`,
        details,
        location,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
