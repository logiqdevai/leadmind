import { BookingStatus, ReminderSource, ReminderStatus, ReminderType } from '@/generated/prisma';
import { BookingTeamReminderService, TeamReminderReason } from './booking-team-reminder.service';

const HOUR = 3_600_000;

function makeBooking(overrides: Record<string, unknown> = {}) {
    return {
        uuid: 'booking-1',
        organisation_uuid: 'org-1',
        contact_uuid: 'contact-1',
        status: BookingStatus.CONFIRMED,
        start_at: new Date(Date.now() + 5 * HOUR),
        duration_minutes: 30,
        invitee_name: 'Ada Lovelace',
        invitee_notes: null,
        location_type: 'NONE',
        location_value: null,
        meeting_url: null,
        reminder: null,
        booking_page: { name: 'Sales call', create_team_reminder: true, team_reminder_offset_minutes: 60 },
        assigned_user_uuid: 'user-1',
        assigned_user: { full_name: 'Sam', email: 'sam@example.com', memberships: [{ organisation_uuid: 'org-1' }] },
        organisation: { timezone: 'UTC' },
        ...overrides,
    };
}

function setup(booking: ReturnType<typeof makeBooking> | null) {
    const prisma = {
        booking: {
            findUnique: jest.fn().mockResolvedValue(booking),
            update: jest.fn().mockResolvedValue({}),
        },
    };
    const reminders = {
        create: jest.fn().mockResolvedValue({ uuid: 'rem-new' }),
        update: jest.fn().mockResolvedValue({}),
    };
    const service = new BookingTeamReminderService(prisma as never, reminders as never);
    return { service, prisma, reminders };
}

const existing = (status: ReminderStatus) => ({ uuid: 'rem-1', status, remind_at: new Date(Date.now() + 4 * HOUR) });

describe('BookingTeamReminderService', () => {
    it('creates a SYSTEM Meeting reminder due before the start and links it to the booking', async () => {
        const booking = makeBooking();
        const { service, prisma, reminders } = setup(booking);
        await service.sync('booking-1', 'created');

        expect(reminders.create).toHaveBeenCalledTimes(1);
        const [org, dto, opts] = reminders.create.mock.calls[0];
        expect(org).toBe('org-1');
        expect(dto.contact_uuid).toBe('contact-1');
        expect(dto.title).toContain('Ada Lovelace');
        expect(new Date(dto.remind_at).getTime()).toBe(booking.start_at.getTime() - HOUR);
        expect(opts).toMatchObject({ source: ReminderSource.SYSTEM, type: ReminderType.MEETING, metadata: { booking_uuid: 'booking-1' } });
        expect(prisma.booking.update).toHaveBeenCalledWith({ where: { uuid: 'booking-1' }, data: { reminder_uuid: 'rem-new' } });
    });

    it.each([
        ['the page setting is off', { booking_page: { name: 'x', create_team_reminder: false, team_reminder_offset_minutes: 60 } }],
        ['the booking has no contact', { contact_uuid: null }],
        ['the booking is still pending', { status: BookingStatus.PENDING }],
        ['the booking is cancelled', { status: BookingStatus.CANCELLED }],
        ['the meeting already started', { start_at: new Date(Date.now() - HOUR) }],
    ])('does nothing when %s', async (_label, overrides) => {
        const { service, reminders } = setup(makeBooking(overrides));
        await service.sync('booking-1', 'created');
        expect(reminders.create).not.toHaveBeenCalled();
        expect(reminders.update).not.toHaveBeenCalled();
    });

    it('does not create a reminder when the meeting starts within a minute', async () => {
        const { service, reminders } = setup(makeBooking({ start_at: new Date(Date.now() + 30_000) }));
        await service.sync('booking-1', 'created');
        expect(reminders.create).not.toHaveBeenCalled();
    });

    it('pushes a reminder that is already due a minute into the future instead of failing', async () => {
        const { service, reminders } = setup(makeBooking({ start_at: new Date(Date.now() + 20 * 60_000) }));
        await service.sync('booking-1', 'created');
        const remindAt = new Date(reminders.create.mock.calls[0][1].remind_at).getTime();
        expect(remindAt).toBeGreaterThan(Date.now());
        expect(remindAt).toBeLessThan(Date.now() + 2 * 60_000);
    });

    it.each<[string, TeamReminderReason, Record<string, unknown>]>([
        ['cancelled', 'cancelled', { status: BookingStatus.CANCELLED }],
        ['completed / no-show', 'status', { status: BookingStatus.COMPLETED }],
        ['moved back to pending', 'updated', { status: BookingStatus.PENDING }],
        ['setting turned off', 'updated', { booking_page: { name: 'x', create_team_reminder: false, team_reminder_offset_minutes: 60 } }],
    ])('cancels the pending reminder when the booking is %s', async (_label, reason, overrides) => {
        const { service, reminders } = setup(makeBooking({ reminder: existing(ReminderStatus.PENDING), ...overrides }));
        await service.sync('booking-1', reason);
        expect(reminders.update).toHaveBeenCalledWith('org-1', 'rem-1', { status: ReminderStatus.CANCELLED });
        expect(reminders.create).not.toHaveBeenCalled();
    });

    it('leaves a reminder the team already completed alone when the booking is cancelled', async () => {
        const { service, reminders } = setup(
            makeBooking({ status: BookingStatus.CANCELLED, reminder: existing(ReminderStatus.COMPLETED) }),
        );
        await service.sync('booking-1', 'cancelled');
        expect(reminders.update).not.toHaveBeenCalled();
    });

    it('moves the pending reminder to the new time on reschedule', async () => {
        const booking = makeBooking({ status: BookingStatus.RESCHEDULED, reminder: existing(ReminderStatus.PENDING) });
        const { service, reminders } = setup(booking);
        await service.sync('booking-1', 'rescheduled');
        expect(reminders.create).not.toHaveBeenCalled();
        const [, , dto] = reminders.update.mock.calls[0];
        expect(new Date(dto.remind_at).getTime()).toBe(booking.start_at.getTime() - HOUR);
    });

    it('assigns the reminder to the member who has the meeting', async () => {
        const { service, reminders } = setup(makeBooking());
        await service.sync('booking-1', 'created');
        expect(reminders.create.mock.calls[0][1].assignee_user_uuids).toEqual(['user-1']);
    });

    it.each([
        ['nobody is assigned', { assigned_user_uuid: null, assigned_user: null }],
        [
            'the assigned member has left the organisation',
            { assigned_user: { full_name: 'Sam', email: 'sam@example.com', memberships: [{ organisation_uuid: 'other-org' }] } },
        ],
    ])('falls back to everyone (no assignees) when %s', async (_label, overrides) => {
        const { service, reminders } = setup(makeBooking(overrides));
        await service.sync('booking-1', 'created');
        expect(reminders.create.mock.calls[0][1].assignee_user_uuids).toEqual([]);
    });

    it('moves a pending reminder to the new member when the booking is reassigned', async () => {
        const { service, reminders } = setup(
            makeBooking({
                reminder: existing(ReminderStatus.PENDING),
                assigned_user_uuid: 'user-2',
                assigned_user: { full_name: 'Alex', email: 'alex@example.com', memberships: [{ organisation_uuid: 'org-1' }] },
            }),
        );
        await service.sync('booking-1', 'updated');
        const [, , dto] = reminders.update.mock.calls[0];
        expect(dto.assignee_user_uuids).toEqual(['user-2']);
        expect(dto.remind_at).toBeUndefined();
    });

    it('does not re-time a pending reminder for edits that do not change the time', async () => {
        const { service, reminders } = setup(makeBooking({ reminder: existing(ReminderStatus.PENDING) }));
        await service.sync('booking-1', 'updated');
        const [, , dto] = reminders.update.mock.calls[0];
        expect(dto.remind_at).toBeUndefined();
        expect(dto.title).toContain('Ada Lovelace');
    });

    it('creates a fresh reminder when a rescheduled booking had its reminder completed or deleted', async () => {
        for (const reminder of [existing(ReminderStatus.COMPLETED), null]) {
            const { service, reminders } = setup(makeBooking({ status: BookingStatus.RESCHEDULED, reminder }));
            await service.sync('booking-1', 'rescheduled');
            expect(reminders.create).toHaveBeenCalledTimes(1);
        }
    });

    it('does not resurrect a handled reminder on a plain edit', async () => {
        for (const reminder of [existing(ReminderStatus.COMPLETED), existing(ReminderStatus.CANCELLED), null]) {
            const { service, reminders } = setup(makeBooking({ reminder }));
            await service.sync('booking-1', 'updated');
            expect(reminders.create).not.toHaveBeenCalled();
        }
    });

    it('syncSafely swallows errors so a reminder problem never fails the booking', async () => {
        const { service, reminders } = setup(makeBooking());
        reminders.create.mockRejectedValue(new Error('boom'));
        await expect(service.syncSafely('booking-1', 'created')).resolves.toBeUndefined();
    });
});
