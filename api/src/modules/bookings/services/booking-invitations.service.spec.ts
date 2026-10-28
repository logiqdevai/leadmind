import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingInvitationStatus, BookingInviteUnit, InteractionType } from '@/generated/prisma';
import { BookingJobNames } from '../constants/booking.constants';
import { BookingInvitationsService } from './booking-invitations.service';

const DAY = 86_400_000;
const LINK_URL = 'https://app.test/book/CODE123';

const page = {
    uuid: 'page-1',
    name: 'Intro call',
    title: '30 minute intro call',
    brand_name: 'logiqdev',
    cta_label: null,
    primary_color: null,
    is_active: true,
};

const contact = {
    uuid: 'contact-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    unsubscribed_at: null,
    bounced_at: null,
};

function makeInvitation(overrides: Record<string, unknown> = {}) {
    return {
        uuid: 'inv-1',
        organisation_uuid: 'org-1',
        booking_page_uuid: 'page-1',
        booking_link_uuid: 'link-1',
        contact_uuid: 'contact-1',
        sent_by_user_uuid: 'user-1',
        recipient_email: 'ada@example.com',
        status: BookingInvitationStatus.ACTIVE,
        reminder_enabled: true,
        reminder_delay_minutes: 3 * 24 * 60,
        max_reminders: 2,
        reminders_sent: 0,
        next_reminder_at: new Date(Date.now() + 3 * DAY),
        last_error: null,
        sent_at: new Date(Date.now() - 3 * DAY),
        booking_link: { code: 'CODE123', is_active: true },
        booking_page: page,
        contact,
        ...overrides,
    };
}

function setup(options: { settings?: Record<string, unknown> | null; contact?: Record<string, unknown> | null } = {}) {
    const prisma = {
        contact: {
            findFirst: jest.fn().mockResolvedValue(options.contact === undefined ? contact : options.contact),
            update: jest.fn().mockResolvedValue({}),
        },
        bookingPage: { findFirst: jest.fn().mockResolvedValue(page) },
        bookingLink: { findFirst: jest.fn() },
        bookingInviteSettings: {
            findUnique: jest.fn().mockResolvedValue(options.settings ?? null),
            upsert: jest.fn().mockResolvedValue({}),
        },
        bookingInvitation: {
            create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ uuid: 'inv-1', status: 'ACTIVE', sent_at: new Date(), last_error: null, reminders_sent: 0, ...data })),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
        },
        booking: { findFirst: jest.fn().mockResolvedValue(null) },
        interaction: { create: jest.fn().mockResolvedValue({}) },
        user: { findUnique: jest.fn().mockResolvedValue({ full_name: 'Petros', email: 'petros@example.com' }) },
        organisation: { findUnique: jest.fn().mockResolvedValue({ name: 'Acme' }) },
    };
    const messageSend = { sendTransactionalEmail: jest.fn().mockResolvedValue({ provider_message_id: 'm1' }) };
    const links = {
        getOrCreateContactLink: jest.fn().mockResolvedValue({ uuid: 'link-1', code: 'CODE123' }),
        publicUrl: jest.fn().mockReturnValue(LINK_URL),
    };
    const queue = { add: jest.fn().mockResolvedValue({}), getJob: jest.fn().mockResolvedValue(null) };
    const service = new BookingInvitationsService(prisma as never, messageSend as never, links as never, queue as never);
    return { service, prisma, messageSend, links, queue };
}

const actor = { uuid: 'user-1', organisation_uuid: 'org-1' };

describe('BookingInvitationsService', () => {
    describe('send', () => {
        it('emails the contact their link and schedules the first reminder from the organisation defaults', async () => {
            const { service, messageSend, queue, prisma } = setup();
            await service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' });

            const email = messageSend.sendTransactionalEmail.mock.calls[0][1];
            expect(email.to).toBe('ada@example.com');
            expect(email.replyTo).toBe('petros@example.com');
            expect(email.subject).toBe('Pick a time: 30 minute intro call');
            expect(email.html).toContain(LINK_URL);
            expect(email.html).toContain('Hi Ada,');

            expect(prisma.bookingInvitation.create.mock.calls[0][0].data).toMatchObject({
                reminder_enabled: true,
                reminder_delay_minutes: 3 * 24 * 60,
                max_reminders: 1,
            });
            expect(queue.add).toHaveBeenCalledWith(
                BookingJobNames.INVITE_REMINDER,
                { invitation_uuid: 'inv-1', reminder_number: 1 },
                expect.objectContaining({ delay: 3 * DAY, jobId: 'booking-invite-reminder-inv-1-1' }),
            );
        });

        it('uses the configured delay, unit and reminder count', async () => {
            const { service, queue, prisma } = setup({
                settings: { reminder_enabled: true, reminder_delay_value: 2, reminder_delay_unit: BookingInviteUnit.WEEKS, max_reminders: 3 },
            });
            await service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' });

            expect(prisma.bookingInvitation.create.mock.calls[0][0].data).toMatchObject({ reminder_delay_minutes: 14 * 24 * 60, max_reminders: 3 });
            expect(queue.add.mock.calls[0][2].delay).toBe(14 * DAY);
        });

        it('schedules nothing when the send opts out of reminders', async () => {
            const { service, queue, prisma } = setup();
            await service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1', remind: false });

            expect(queue.add).not.toHaveBeenCalled();
            expect(prisma.bookingInvitation.create.mock.calls[0][0].data).toMatchObject({ reminder_enabled: false, max_reminders: 0, next_reminder_at: null });
        });

        it('follows the organisation default when the send does not choose', async () => {
            const { service, queue } = setup({ settings: { reminder_enabled: false, reminder_delay_value: 3, reminder_delay_unit: 'DAYS', max_reminders: 1 } });
            await service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' });
            expect(queue.add).not.toHaveBeenCalled();
        });

        it.each([
            ['has no email', { ...contact, email: null }],
            ['unsubscribed', { ...contact, unsubscribed_at: new Date() }],
            ['bounced', { ...contact, bounced_at: new Date() }],
        ])('refuses a contact that %s without sending', async (_label, blocked) => {
            const { service, messageSend } = setup({ contact: blocked });
            await expect(service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' })).rejects.toBeInstanceOf(BadRequestException);
            expect(messageSend.sendTransactionalEmail).not.toHaveBeenCalled();
        });

        it('creates no invitation when the email fails', async () => {
            const { service, messageSend, prisma, queue } = setup();
            messageSend.sendTransactionalEmail.mockRejectedValue(new Error('smtp down'));
            await expect(service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' })).rejects.toThrow('smtp down');
            expect(prisma.bookingInvitation.create).not.toHaveBeenCalled();
            expect(queue.add).not.toHaveBeenCalled();
        });

        it('appends the booking button when a custom message has no link variable', async () => {
            const { service, messageSend } = setup({
                settings: { invite_message: 'Hello {{contact.first_name}}, let us talk.', reminder_enabled: false, reminder_delay_value: 3, reminder_delay_unit: 'DAYS', max_reminders: 1 },
            });
            await service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' });
            const { html } = messageSend.sendTransactionalEmail.mock.calls[0][1];
            expect(html).toContain('Hello Ada, let us talk.');
            expect(html).toContain(`href="${LINK_URL}"`);
        });

        it('escapes contact-provided text in the email body', async () => {
            const { service, messageSend } = setup({ contact: { ...contact, name: '<script>x</script> Ada' } });
            await service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' });
            expect(messageSend.sendTransactionalEmail.mock.calls[0][1].html).not.toContain('<script>');
        });
    });

    describe('contact timeline', () => {
        it('records the emailed link as a BOOKING_LINK_SENT interaction and touches the contact', async () => {
            const { service, prisma } = setup();
            await service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' });

            const data = prisma.interaction.create.mock.calls[0][0].data;
            expect(data).toMatchObject({
                contact_uuid: 'contact-1',
                organisation_uuid: 'org-1',
                type: InteractionType.BOOKING_LINK_SENT,
                created_by_user_uuid: 'user-1',
            });
            expect(data.content).toContain('30 minute intro call');
            expect(data.content).toContain('ada@example.com');
            expect(data.metadata).toMatchObject({ booking_invitation_uuid: 'inv-1', booking_page_uuid: 'page-1' });
            expect(prisma.contact.update.mock.calls[0][0]).toMatchObject({ where: { uuid: 'contact-1' } });
        });

        it('records each sent reminder as BOOKING_REMINDER_SENT', async () => {
            const { service, prisma } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation());
            await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 });

            const data = prisma.interaction.create.mock.calls[0][0].data;
            expect(data.type).toBe(InteractionType.BOOKING_REMINDER_SENT);
            expect(data.content).toContain('Reminder 1 of 2');
            expect(data.metadata).toMatchObject({ reminder_number: 1 });
        });

        it('logs nothing when the reminder is skipped', async () => {
            const { service, prisma } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation());
            prisma.booking.findFirst.mockResolvedValue({ uuid: 'booking-1' });
            await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 });
            expect(prisma.interaction.create).not.toHaveBeenCalled();
        });

        it('still succeeds when the timeline write fails', async () => {
            const { service, prisma, messageSend } = setup();
            prisma.interaction.create.mockRejectedValue(new Error('db down'));
            await expect(service.send(actor, { contact_uuid: 'contact-1', booking_page_uuid: 'page-1' })).resolves.toBeDefined();
            expect(messageSend.sendTransactionalEmail).toHaveBeenCalledTimes(1);
        });
    });

    describe('resend', () => {
        it('emails the same link again and restarts the reminders', async () => {
            const { service, prisma, messageSend, queue } = setup();
            prisma.bookingInvitation.findFirst.mockResolvedValue({ contact_uuid: 'contact-1', booking_link_uuid: 'link-1', reminder_enabled: true });
            prisma.bookingLink.findFirst.mockResolvedValue({ uuid: 'link-1', code: 'CODE123', is_active: true, booking_page: page });

            await service.resend(actor, 'inv-0');

            expect(prisma.bookingLink.findFirst.mock.calls[0][0].where).toMatchObject({ uuid: 'link-1', contact_uuid: 'contact-1' });
            expect(messageSend.sendTransactionalEmail).toHaveBeenCalledTimes(1);
            expect(queue.add).toHaveBeenCalledWith(BookingJobNames.INVITE_REMINDER, { invitation_uuid: 'inv-1', reminder_number: 1 }, expect.anything());
        });

        it('keeps reminders off when the original send had them off', async () => {
            const { service, prisma, queue } = setup();
            prisma.bookingInvitation.findFirst.mockResolvedValue({ contact_uuid: 'contact-1', booking_link_uuid: 'link-1', reminder_enabled: false });
            prisma.bookingLink.findFirst.mockResolvedValue({ uuid: 'link-1', code: 'CODE123', is_active: true, booking_page: page });
            await service.resend(actor, 'inv-0');
            expect(queue.add).not.toHaveBeenCalled();
        });

        it('rejects an unknown invitation', async () => {
            const { service, prisma } = setup();
            prisma.bookingInvitation.findFirst.mockResolvedValue(null);
            await expect(service.resend(actor, 'nope')).rejects.toBeInstanceOf(NotFoundException);
        });

        it('rejects a link that was deactivated since', async () => {
            const { service, prisma, messageSend } = setup();
            prisma.bookingInvitation.findFirst.mockResolvedValue({ contact_uuid: 'contact-1', booking_link_uuid: 'link-1', reminder_enabled: true });
            prisma.bookingLink.findFirst.mockResolvedValue({ uuid: 'link-1', code: 'CODE123', is_active: false, booking_page: page });
            await expect(service.resend(actor, 'inv-0')).rejects.toBeInstanceOf(BadRequestException);
            expect(messageSend.sendTransactionalEmail).not.toHaveBeenCalled();
        });
    });

    describe('processReminder', () => {
        it('ends the sequence without emailing when the contact has booked', async () => {
            const { service, prisma, messageSend } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation());
            prisma.booking.findFirst.mockResolvedValue({ uuid: 'booking-1' });

            await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 });

            expect(messageSend.sendTransactionalEmail).not.toHaveBeenCalled();
            expect(prisma.bookingInvitation.update.mock.calls[0][0].data).toMatchObject({ status: BookingInvitationStatus.BOOKED, next_reminder_at: null });
        });

        it('sends the reminder and queues the next one while reminders remain', async () => {
            const { service, prisma, messageSend, queue } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation());

            await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 });

            const email = messageSend.sendTransactionalEmail.mock.calls[0][1];
            expect(email.subject).toBe('Reminder: pick a time for 30 minute intro call');
            expect(email.html).toContain(LINK_URL);
            expect(prisma.bookingInvitation.update.mock.calls[0][0].data).toMatchObject({ reminders_sent: 1, status: BookingInvitationStatus.ACTIVE });
            expect(queue.add).toHaveBeenCalledWith(
                BookingJobNames.INVITE_REMINDER,
                { invitation_uuid: 'inv-1', reminder_number: 2 },
                expect.objectContaining({ delay: 3 * DAY }),
            );
        });

        it('stops after the last reminder', async () => {
            const { service, prisma, queue } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation({ reminders_sent: 1 }));

            await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 2 });

            expect(prisma.bookingInvitation.update.mock.calls[0][0].data).toMatchObject({ reminders_sent: 2, status: BookingInvitationStatus.STOPPED, next_reminder_at: null });
            expect(queue.add).not.toHaveBeenCalled();
        });

        it('does not resend a reminder that already went out', async () => {
            const { service, prisma, messageSend } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation({ reminders_sent: 1 }));
            await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 });
            expect(messageSend.sendTransactionalEmail).not.toHaveBeenCalled();
        });

        it('stops for a deactivated link, an inactive page or a contact who unsubscribed', async () => {
            for (const override of [
                { booking_link: { code: 'CODE123', is_active: false } },
                { booking_page: { ...page, is_active: false } },
                { contact: { ...contact, unsubscribed_at: new Date() } },
            ]) {
                const { service, prisma, messageSend } = setup();
                prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation(override));
                await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 });
                expect(messageSend.sendTransactionalEmail).not.toHaveBeenCalled();
                expect(prisma.bookingInvitation.update.mock.calls[0][0].data.status).toBe(BookingInvitationStatus.STOPPED);
            }
        });

        it('ignores stopped invitations', async () => {
            const { service, prisma, messageSend } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation({ status: BookingInvitationStatus.STOPPED }));
            await service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 });
            expect(messageSend.sendTransactionalEmail).not.toHaveBeenCalled();
            expect(prisma.bookingInvitation.update).not.toHaveBeenCalled();
        });

        it('rethrows a failed send so the queue retries, keeping the error on the invitation', async () => {
            const { service, prisma, messageSend } = setup();
            prisma.bookingInvitation.findUnique.mockResolvedValue(makeInvitation());
            messageSend.sendTransactionalEmail.mockRejectedValue(new Error('smtp down'));

            await expect(service.processReminder({ invitation_uuid: 'inv-1', reminder_number: 1 })).rejects.toThrow('smtp down');
            expect(prisma.bookingInvitation.update.mock.calls[0][0].data).toEqual({ last_error: 'smtp down' });
        });
    });

    describe('updateSettings', () => {
        it('rejects a delay longer than 90 days', async () => {
            const { service } = setup();
            await expect(service.updateSettings('org-1', { reminder_delay_value: 20, reminder_delay_unit: BookingInviteUnit.WEEKS })).rejects.toBeInstanceOf(BadRequestException);
        });

        it('stores an emptied message as null so the default applies again', async () => {
            const { service, prisma } = setup();
            await service.updateSettings('org-1', { invite_message: '   ', reminder_delay_value: 5 });
            expect(prisma.bookingInviteSettings.upsert.mock.calls[0][0].update).toMatchObject({ invite_message: null, reminder_delay_value: 5 });
        });
    });

    describe('stop', () => {
        it('ends the invitation and removes its queued reminder jobs', async () => {
            const { service, prisma, queue } = setup();
            prisma.bookingInvitation.findFirst.mockResolvedValue(makeInvitation({ max_reminders: 2 }));
            const remove = jest.fn();
            queue.getJob.mockResolvedValue({ isActive: jest.fn().mockResolvedValue(false), remove });

            await service.stop('org-1', 'inv-1');

            expect(prisma.bookingInvitation.update.mock.calls[0][0].data).toMatchObject({ status: BookingInvitationStatus.STOPPED, next_reminder_at: null });
            expect(remove).toHaveBeenCalledTimes(2);
        });
    });
});
