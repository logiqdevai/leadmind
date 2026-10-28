import { BookingLocationType, BookingNotificationKind, BookingStatus } from '@/generated/prisma';
import { BookingNotificationsService } from './booking-notifications.service';

const SIGNATURE = '<p><strong>Petros</strong></p>';

function makeBooking(overrides: Record<string, unknown> = {}) {
    return {
        uuid: 'booking-1',
        organisation_uuid: 'org-1',
        status: BookingStatus.CONFIRMED,
        start_at: new Date('2027-01-10T10:00:00Z'),
        end_at: new Date('2027-01-10T10:30:00Z'),
        duration_minutes: 30,
        invitee_name: 'Ada Lovelace',
        invitee_email: 'ada@example.com',
        invitee_phone: null,
        invitee_notes: null,
        invitee_timezone: 'Europe/Athens',
        invitee_language: null,
        cancellation_reason: null,
        location_type: BookingLocationType.GOOGLE_MEET,
        location_value: null,
        meeting_url: 'https://meet.google.com/abc-defg-hij',
        manage_token: 'tok',
        assigned_user_uuid: 'user-1',
        assigned_user: { full_name: 'Petros', email: 'petros@example.com' },
        organisation: { name: 'Acme', timezone: 'Europe/Athens', slug: 'acme' },
        contact: { country: null },
        booking_page: {
            title: 'Intro call',
            name: 'Intro call',
            slug: 'intro-call',
            is_active: true,
            cta_label: null,
            primary_color: null,
            brand_name: null,
            send_confirmation_email: true,
            send_reminder_emails: true,
            send_cancellation_email: true,
            send_reschedule_email: true,
            notify_assignee: false,
            additional_recipients: [],
            include_meeting_link: true,
            include_calendar_details: true,
            notification_templates: [],
        },
        ...overrides,
    };
}

async function sendConfirmation(
    booking: ReturnType<typeof makeBooking>,
    template?: { email_subject: string; email_content: string; language: string },
    kind: BookingNotificationKind = BookingNotificationKind.CONFIRMATION,
) {
    if (template) booking.booking_page.notification_templates = [{ kind, template } as never];
    const prisma = {
        booking: { findUnique: jest.fn().mockResolvedValue(booking) },
        bookingNotification: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    };
    const messageSend = { sendTransactionalEmail: jest.fn().mockResolvedValue({}) };
    const outreachRender = { buildVarsForTeamMember: jest.fn().mockResolvedValue({ signature: SIGNATURE }) };
    const events = { record: jest.fn().mockResolvedValue({}) };
    const config = { get: jest.fn().mockReturnValue('https://app.test') };
    const service = new BookingNotificationsService(
        prisma as never,
        config as never,
        messageSend as never,
        outreachRender as never,
        events as never,
        { add: jest.fn() } as never,
    );
    await service.process({ booking_uuid: 'booking-1', kind, scheduled_for_start: booking.start_at.toISOString() } as never);
    return messageSend.sendTransactionalEmail.mock.calls[0][1].html as string;
}

describe('BookingNotificationsService', () => {
    it('puts the join and calendar links before the signature of the default confirmation', async () => {
        const html = await sendConfirmation(makeBooking());
        const signatureAt = html.indexOf(SIGNATURE);
        expect(signatureAt).toBeGreaterThan(-1);
        expect(html.indexOf('Join:')).toBeGreaterThan(-1);
        expect(html.indexOf('Join:')).toBeLessThan(signatureAt);
        expect(html.indexOf('Add to Google Calendar')).toBeLessThan(signatureAt);
        expect(html.endsWith(SIGNATURE)).toBe(true);
    });

    it('does the same for a custom template that ends with {{signature}}', async () => {
        const html = await sendConfirmation(makeBooking(), {
            language: 'en',
            email_subject: 'Hi',
            email_content: '<p>See you, {{contact.first_name}}</p>{{signature}}',
        });
        expect(html.indexOf('Join:')).toBeLessThan(html.indexOf(SIGNATURE));
        expect(html.endsWith(SIGNATURE)).toBe(true);
    });

    it('appends the links at the end when the template has no {{signature}}', async () => {
        const html = await sendConfirmation(makeBooking(), {
            language: 'en',
            email_subject: 'Hi',
            email_content: '<p>See you</p>',
        });
        expect(html.startsWith('<p>See you</p>')).toBe(true);
        expect(html).toContain('Join:');
        expect(html).not.toContain(SIGNATURE);
    });

    describe('cancellation', () => {
        const cancelled = (overrides: Record<string, unknown> = {}) => makeBooking({ status: BookingStatus.CANCELLED, ...overrides });
        const BOOK_URL = 'https://app.test/book/acme/intro-call';

        it('offers the booking page to pick a new time, right before the signature', async () => {
            const html = await sendConfirmation(cancelled(), undefined, BookingNotificationKind.CANCELLATION);
            expect(html).toContain(`href="${BOOK_URL}"`);
            expect(html).toContain('Book a new time');
            expect(html.indexOf(BOOK_URL)).toBeLessThan(html.indexOf(SIGNATURE));
            expect(html.endsWith(SIGNATURE)).toBe(true);
            // Cancelled meetings are not offered a reschedule link.
            expect(html).not.toContain('/reschedule');
        });

        it('adds the button to a custom template that does not use the variable, in the template language', async () => {
            const html = await sendConfirmation(
                cancelled(),
                { language: 'el', email_subject: 'Ακυρώθηκε', email_content: '<p>Ακυρώθηκε.</p>{{signature}}' },
                BookingNotificationKind.CANCELLATION,
            );
            expect(html).toContain('Κλείστε νέα ώρα');
            expect(html.indexOf(BOOK_URL)).toBeLessThan(html.indexOf(SIGNATURE));
        });

        it('does not duplicate the button when the template places it itself', async () => {
            const html = await sendConfirmation(
                cancelled(),
                { language: 'en', email_subject: 'Cancelled', email_content: '<p>Cancelled.</p>{{booking.book_again_link}}<p>Bye</p>{{signature}}' },
                BookingNotificationKind.CANCELLATION,
            );
            expect(html.split(BOOK_URL).length - 1).toBe(1);
            expect(html.indexOf(BOOK_URL)).toBeLessThan(html.indexOf('Bye'));
        });

        it('leaves the button out when the booking has no active page', async () => {
            const booking = cancelled();
            booking.booking_page.is_active = false;
            const html = await sendConfirmation(booking, undefined, BookingNotificationKind.CANCELLATION);
            expect(html).not.toContain('Book a new time');
        });
    });
});
