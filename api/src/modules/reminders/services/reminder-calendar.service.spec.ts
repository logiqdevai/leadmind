import { BookingSource, BookingStatus, CalendarConnectionStatus } from '@/generated/prisma';
import { ReminderCalendarService } from './reminder-calendar.service';

const REMIND_AT = new Date('2026-11-01T10:00:00.000Z');

function setup(connection: Record<string, unknown> | null = {}) {
    const prisma = {
        calendarConnection: {
            findUnique: jest.fn().mockResolvedValue(
                connection && {
                    uuid: 'conn-1',
                    user_uuid: 'user-me',
                    calendar_id: 'primary',
                    composio_connected_account_id: 'acct-1',
                    status: CalendarConnectionStatus.ACTIVE,
                    ...connection,
                },
            ),
            update: jest.fn(),
        },
        reminder: {
            findUnique: jest.fn().mockResolvedValue({
                organisation_uuid: 'org-1',
                contact: { uuid: 'c-1', email: 'ada@x.io' },
                organisation: { timezone: 'Europe/Athens' },
            }),
            update: jest.fn().mockResolvedValue({}),
        },
        booking: {
            upsert: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
    };
    const googleCalendar = {
        upsertEvent: jest.fn().mockResolvedValue({ event_id: 'evt-1' }),
        deleteEvent: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ReminderCalendarService(prisma as never, googleCalendar as never);
    return { service, prisma, googleCalendar };
}

const reminder = (over: Record<string, unknown> = {}) => ({
    uuid: 'rem-1',
    title: 'Call back',
    notes: 'Ask about pricing',
    remind_at: REMIND_AT,
    calendar_event_id: null,
    calendar_connection_uuid: null,
    contact: { name: 'Ada', company: null },
    ...over,
});

describe('ReminderCalendarService', () => {
    describe('upsert', () => {
        it('creates the Google event and an empty REMINDER booking for the same slot', async () => {
            const { service, prisma, googleCalendar } = setup();
            expect(await service.upsert(reminder(), 'conn-1')).toBe(true);

            expect(googleCalendar.upsertEvent).toHaveBeenCalledTimes(1);
            expect(prisma.booking.upsert).toHaveBeenCalledTimes(1);
            const args = prisma.booking.upsert.mock.calls[0][0];
            expect(args.where).toEqual({ source_reminder_uuid: 'rem-1' });
            expect(args.create).toMatchObject({
                organisation_uuid: 'org-1',
                source: BookingSource.REMINDER,
                source_reminder_uuid: 'rem-1',
                status: BookingStatus.CONFIRMED,
                contact_uuid: 'c-1',
                assigned_user_uuid: 'user-me',
                start_at: REMIND_AT,
                end_at: new Date(REMIND_AT.getTime() + 15 * 60_000),
                duration_minutes: 15,
                invitee_name: 'Reminder: Call back',
                invitee_email: 'ada@x.io',
            });
            // The reminder owns the Google event; the inbound sync matches bookings by this id.
            expect(args.create).not.toHaveProperty('calendar_event_id');
        });

        it('moves the existing booking when the reminder changes (update branch carries the new time)', async () => {
            const { service, prisma } = setup();
            const later = new Date(REMIND_AT.getTime() + 3_600_000);
            await service.upsert(reminder({ remind_at: later, calendar_event_id: 'evt-1' }), 'conn-1');
            expect(prisma.booking.upsert.mock.calls[0][0].update).toMatchObject({
                start_at: later,
                end_at: new Date(later.getTime() + 15 * 60_000),
            });
        });

        it('falls back to an empty invitee email when the contact has none', async () => {
            const { service, prisma } = setup();
            prisma.reminder.findUnique.mockResolvedValue({
                organisation_uuid: 'org-1',
                contact: { uuid: 'c-1', email: null },
                organisation: { timezone: 'UTC' },
            });
            await service.upsert(reminder(), 'conn-1');
            expect(prisma.booking.upsert.mock.calls[0][0].create.invitee_email).toBe('');
        });

        it('creates nothing when Google fails, so the calendars never disagree on a new reminder', async () => {
            const { service, prisma, googleCalendar } = setup();
            googleCalendar.upsertEvent.mockRejectedValue(new Error('boom'));
            expect(await service.upsert(reminder(), 'conn-1')).toBe(false);
            expect(prisma.booking.upsert).not.toHaveBeenCalled();
        });

        it('still reports success when only the booking write fails', async () => {
            const { service, prisma } = setup();
            prisma.booking.upsert.mockRejectedValue(new Error('db'));
            expect(await service.upsert(reminder(), 'conn-1')).toBe(true);
        });

        it('does nothing without a usable connection', async () => {
            const { service, prisma, googleCalendar } = setup({ status: CalendarConnectionStatus.EXPIRED });
            expect(await service.upsert(reminder(), 'conn-1')).toBe(false);
            expect(googleCalendar.upsertEvent).not.toHaveBeenCalled();
            expect(prisma.booking.upsert).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        const onCalendar = { uuid: 'rem-1', calendar_event_id: 'evt-1', calendar_connection_uuid: 'conn-1' };

        it('deletes the Google event and the booking and forgets the connection', async () => {
            const { service, prisma, googleCalendar } = setup();
            await service.remove(onCalendar);
            expect(googleCalendar.deleteEvent).toHaveBeenCalledWith('acct-1', 'primary', 'evt-1');
            expect(prisma.booking.deleteMany).toHaveBeenCalledWith({ where: { source_reminder_uuid: 'rem-1' } });
            expect(prisma.reminder.update).toHaveBeenCalledWith({
                where: { uuid: 'rem-1' },
                data: { calendar_event_id: null, calendar_connection_uuid: null },
            });
        });

        it('keeps the connection when asked, so a reopened reminder can be restored', async () => {
            const { service, prisma } = setup();
            await service.remove(onCalendar, { keep_connection: true });
            expect(prisma.reminder.update).toHaveBeenCalledWith({
                where: { uuid: 'rem-1' },
                data: { calendar_event_id: null },
            });
        });

        it('still deletes the booking and clears the reminder when the Google delete fails', async () => {
            const { service, prisma, googleCalendar } = setup();
            googleCalendar.deleteEvent.mockRejectedValue(new Error('boom'));
            await service.remove(onCalendar);
            expect(prisma.booking.deleteMany).toHaveBeenCalled();
            expect(prisma.reminder.update).toHaveBeenCalled();
        });

        it('only clears the kept connection when there is no event to delete', async () => {
            const { service, prisma, googleCalendar } = setup();
            await service.remove({ uuid: 'rem-1', calendar_event_id: null, calendar_connection_uuid: 'conn-1' });
            expect(googleCalendar.deleteEvent).not.toHaveBeenCalled();
            expect(prisma.reminder.update).toHaveBeenCalledWith({
                where: { uuid: 'rem-1' },
                data: { calendar_event_id: null, calendar_connection_uuid: null },
            });
        });
    });
});
