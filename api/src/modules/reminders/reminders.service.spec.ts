import { BadRequestException } from '@nestjs/common';
import { ReminderStatus } from '@/generated/prisma';
import { RemindersService } from './reminders.service';

const ORG = 'org-1';
const ME = 'user-me';
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

function setup(members: string[] = [ME, 'user-2', 'user-3']) {
    const created = (data: { assignees?: { create: { user_uuid: string }[] } }) => ({
        uuid: 'rem-1',
        organisation_uuid: ORG,
        contact: { uuid: 'c-1', name: 'Ada', company: null, email: null },
        assignees: (data.assignees?.create ?? []).map((a) => ({
            user: { uuid: a.user_uuid, full_name: a.user_uuid, email: `${a.user_uuid}@x.io` },
        })),
    });
    const prisma = {
        contact: { findFirst: jest.fn().mockResolvedValue({ uuid: 'c-1' }) },
        organisation: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
        organisationMember: {
            count: jest.fn(({ where }) => Promise.resolve(where.user_uuid.in.filter((u: string) => members.includes(u)).length)),
            findMany: jest.fn().mockResolvedValue(members.map((user_uuid) => ({ user_uuid }))),
        },
        reminder: {
            create: jest.fn(({ data }) => Promise.resolve(created(data))),
            update: jest.fn(({ data }) => Promise.resolve({ ...created(data), uuid: 'rem-1' })),
            findFirst: jest.fn().mockResolvedValue({ uuid: 'rem-1', status: ReminderStatus.PENDING, job_id: null }),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        },
    };
    const gateway = { emitToUsers: jest.fn(), emitToUser: jest.fn() };
    const queue = { add: jest.fn(), getJob: jest.fn() };
    const service = new RemindersService(prisma as never, gateway as never, {} as never, queue as never, { register: jest.fn() } as never);
    return { service, prisma, gateway };
}

const assigneesWritten = (prisma: ReturnType<typeof setup>['prisma']) =>
    (prisma.reminder.create.mock.calls[0][0].data.assignees.create as { user_uuid: string }[]).map((a) => a.user_uuid);

describe('RemindersService assignees', () => {
    const dto = { contact_uuid: 'c-1', remind_at: FUTURE };

    it('defaults the assignee to the member creating the reminder', async () => {
        const { service, prisma } = setup();
        const reminder = await service.create(ORG, dto, { created_by_user_uuid: ME });
        expect(assigneesWritten(prisma)).toEqual([ME]);
        expect(reminder.assignees.map((a) => a.uuid)).toEqual([ME]);
    });

    it('uses the given members instead of the creator', async () => {
        const { service, prisma } = setup();
        await service.create(ORG, { ...dto, assignee_user_uuids: ['user-2', 'user-3'] }, { created_by_user_uuid: ME });
        expect(assigneesWritten(prisma)).toEqual(['user-2', 'user-3']);
    });

    it('treats an explicit empty list as "everyone", even for a member creating it', async () => {
        const { service, prisma } = setup();
        await service.create(ORG, { ...dto, assignee_user_uuids: [] }, { created_by_user_uuid: ME });
        expect(assigneesWritten(prisma)).toEqual([]);
    });

    it('leaves system reminders (no creator, no assignees) for everyone', async () => {
        const { service, prisma } = setup();
        await service.create(ORG, dto);
        expect(assigneesWritten(prisma)).toEqual([]);
    });

    it('collapses duplicates and rejects people who are not members of the organisation', async () => {
        const { service, prisma } = setup();
        await service.create(ORG, { ...dto, assignee_user_uuids: ['user-2', 'user-2'] });
        expect(assigneesWritten(prisma)).toEqual(['user-2']);

        const outsider = setup();
        await expect(
            outsider.service.create(ORG, { ...dto, assignee_user_uuids: ['user-2', 'stranger'] }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(outsider.prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('notifies only the assignees about changes to their reminder', async () => {
        const { service, gateway } = setup();
        await service.create(ORG, { ...dto, assignee_user_uuids: ['user-2'] });
        expect(gateway.emitToUsers).toHaveBeenCalledWith(['user-2'], 'reminder.created', expect.anything());
    });

    it('replaces the assignees on update, and leaves them alone when not provided', async () => {
        const { service, prisma } = setup();
        await service.update(ORG, 'rem-1', { assignee_user_uuids: ['user-3'] });
        expect(prisma.reminder.update.mock.calls[0][0].data.assignees).toEqual({
            deleteMany: {},
            create: [{ user_uuid: 'user-3' }],
        });

        await service.update(ORG, 'rem-1', { title: 'New title' });
        expect(prisma.reminder.update.mock.calls[1][0].data).not.toHaveProperty('assignees');

        await service.update(ORG, 'rem-1', { assignee_user_uuids: [] });
        expect(prisma.reminder.update.mock.calls[2][0].data.assignees).toEqual({ deleteMany: {}, create: [] });
    });

    it('lists what a member receives: their reminders plus the ones for everyone', async () => {
        const { service, prisma } = setup();
        await service.findAll(ORG, { for_user_uuid: ME });
        expect(prisma.reminder.findMany.mock.calls[0][0].where.AND).toEqual([
            { OR: [{ assignees: { some: { user_uuid: ME } } }, { assignees: { none: {} } }] },
        ]);
    });

    describe('getRecipientUserUuids', () => {
        it('returns every member when there are no assignees', async () => {
            const { service } = setup();
            expect(await service.getRecipientUserUuids({ organisation_uuid: ORG, assignees: [] })).toEqual([ME, 'user-2', 'user-3']);
        });

        it('returns only the assignees', async () => {
            const { service } = setup();
            expect(
                await service.getRecipientUserUuids({ organisation_uuid: ORG, assignees: [{ user_uuid: 'user-2' }] }),
            ).toEqual(['user-2']);
        });

        it('ignores assignees who have left, and falls back to everyone if none remain', async () => {
            const { service } = setup();
            expect(
                await service.getRecipientUserUuids({
                    organisation_uuid: ORG,
                    assignees: [{ user_uuid: 'user-2' }, { user_uuid: 'gone' }],
                }),
            ).toEqual(['user-2']);
            expect(
                await service.getRecipientUserUuids({ organisation_uuid: ORG, assignees: [{ user_uuid: 'gone' }] }),
            ).toEqual([ME, 'user-2', 'user-3']);
        });
    });
});

describe('RemindersService Google Calendar sync', () => {
    function calendarSetup(existing: Record<string, unknown>) {
        const row = (over: Record<string, unknown> = {}) => ({
            uuid: 'rem-1',
            organisation_uuid: ORG,
            status: ReminderStatus.PENDING,
            job_id: null,
            calendar_event_id: null,
            calendar_connection_uuid: null,
            contact: { uuid: 'c-1', name: 'Ada', company: null, email: null },
            assignees: [],
            ...existing,
            ...over,
        });
        const prisma = {
            organisationMember: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
            reminder: {
                findFirst: jest.fn().mockResolvedValue(row()),
                update: jest.fn(({ data }) => Promise.resolve(row(data.status ? { status: data.status } : {}))),
            },
        };
        const calendar = {
            requireConnection: jest.fn().mockResolvedValue({ uuid: 'conn-new' }),
            upsert: jest.fn().mockResolvedValue(true),
            remove: jest.fn().mockResolvedValue(undefined),
        };
        const gateway = { emitToUsers: jest.fn() };
        const queue = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };
        const service = new RemindersService(prisma as never, gateway as never, calendar as never, queue as never, { register: jest.fn() } as never);
        return { service, calendar };
    }

    const onCalendar = { calendar_event_id: 'evt-1', calendar_connection_uuid: 'conn-1' };
    // What a reminder looks like after it was completed while on the calendar.
    const completedOnCalendar = { status: ReminderStatus.COMPLETED, calendar_event_id: null, calendar_connection_uuid: 'conn-1' };

    it('refreshes the event and booking when the time, title or notes change', async () => {
        const { service, calendar } = calendarSetup(onCalendar);
        await service.update(ORG, 'rem-1', { title: 'New title' });
        expect(calendar.upsert).toHaveBeenCalledWith(expect.anything(), 'conn-1');
        expect(calendar.remove).not.toHaveBeenCalled();
    });

    it('leaves both calendars alone when nothing calendar-relevant changed', async () => {
        const { service, calendar } = calendarSetup(onCalendar);
        await service.update(ORG, 'rem-1', { assignee_user_uuids: [] });
        expect(calendar.upsert).not.toHaveBeenCalled();
        expect(calendar.remove).not.toHaveBeenCalled();
    });

    it('removes the event and booking on completion, keeping the connection for a later reopen', async () => {
        const { service, calendar } = calendarSetup(onCalendar);
        await service.update(ORG, 'rem-1', { status: ReminderStatus.COMPLETED });
        expect(calendar.remove).toHaveBeenCalledWith(expect.objectContaining(onCalendar), { keep_connection: true });
        expect(calendar.upsert).not.toHaveBeenCalled();
    });

    it('removes everything, connection included, when switched off', async () => {
        const { service, calendar } = calendarSetup(onCalendar);
        await service.update(ORG, 'rem-1', { add_to_google_calendar: false });
        expect(calendar.remove).toHaveBeenCalledWith(expect.objectContaining(onCalendar), { keep_connection: false });
    });

    it('forgets the kept connection when switched off while completed', async () => {
        const { service, calendar } = calendarSetup(completedOnCalendar);
        await service.update(ORG, 'rem-1', { add_to_google_calendar: false });
        expect(calendar.remove).toHaveBeenCalledWith(expect.anything(), { keep_connection: false });
    });

    it('restores the event and booking when a completed reminder is reopened', async () => {
        const { service, calendar } = calendarSetup(completedOnCalendar);
        await service.update(ORG, 'rem-1', { status: ReminderStatus.PENDING });
        expect(calendar.upsert).toHaveBeenCalledWith(expect.anything(), 'conn-1');
        expect(calendar.remove).not.toHaveBeenCalled();
    });

    it('does not restore when reopening and switching Google Calendar off in the same edit', async () => {
        const { service, calendar } = calendarSetup(completedOnCalendar);
        await service.update(ORG, 'rem-1', { status: ReminderStatus.PENDING, add_to_google_calendar: false });
        expect(calendar.upsert).not.toHaveBeenCalled();
    });

    it('does not restore a reminder that was never on the calendar', async () => {
        const { service, calendar } = calendarSetup({ status: ReminderStatus.COMPLETED });
        await service.update(ORG, 'rem-1', { status: ReminderStatus.PENDING });
        expect(calendar.upsert).not.toHaveBeenCalled();
    });

    it('leaves a completed reminder alone while it stays completed', async () => {
        const { service, calendar } = calendarSetup(completedOnCalendar);
        await service.update(ORG, 'rem-1', { notes: 'later' });
        expect(calendar.upsert).not.toHaveBeenCalled();
        expect(calendar.remove).not.toHaveBeenCalled();
    });

    it('removes the event and booking when the reminder is deleted', async () => {
        const { service, calendar } = calendarSetup(onCalendar);
        (service as unknown as { prisma: { reminder: Record<string, jest.Mock> } }).prisma.reminder.delete = jest.fn();
        await service.remove(ORG, 'rem-1');
        expect(calendar.remove).toHaveBeenCalledWith(expect.objectContaining(onCalendar));
    });
});
