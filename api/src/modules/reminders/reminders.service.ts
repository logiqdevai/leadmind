import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import { Prisma, ReminderSource, ReminderStatus, ReminderType } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { REMINDER_TRIGGER_QUEUE } from '@/core/queues/queues.constants';
import { NotificationsGateway } from '@/gateways/notifications.gateway';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ListRemindersDto } from './dto/list-reminders.dto';
import { ActivityUndoRegistry } from '@/modules/activity-logs/activity-undo.registry';
import { ReminderCalendarService } from './services/reminder-calendar.service';

const CONTACT_SELECT = {
    uuid: true,
    name: true,
    company: true,
    email: true,
} satisfies Prisma.ContactSelect;

const REMINDER_INCLUDE = {
    contact: { select: CONTACT_SELECT },
    assignees: { include: { user: { select: { uuid: true, full_name: true, email: true } } } },
} satisfies Prisma.ReminderInclude;

type ReminderWithRelations = Prisma.ReminderGetPayload<{ include: typeof REMINDER_INCLUDE }>;

/** API shape: `assignees` is the list of members (empty = every member of the organisation). */
export type ReminderView = Omit<ReminderWithRelations, 'assignees'> & {
    assignees: { uuid: string; full_name: string | null; email: string }[];
};

function toView(reminder: ReminderWithRelations): ReminderView {
    return { ...reminder, assignees: reminder.assignees.map((a) => a.user) };
}

@Injectable()
export class RemindersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: NotificationsGateway,
        private readonly calendar: ReminderCalendarService,
        @InjectQueue(REMINDER_TRIGGER_QUEUE) private readonly reminderQueue: Queue,
        undoRegistry: ActivityUndoRegistry,
    ) {
        undoRegistry.register('reminder', {
            remove: async (organisation_uuid, uuid) => {
                await this.remove(organisation_uuid, uuid);
            },
            restore: (organisation_uuid, snapshot, relations) =>
                this.restoreFromSnapshot(organisation_uuid, snapshot, relations),
            revert: (organisation_uuid, uuid, values, relations) =>
                this.revertToValues(organisation_uuid, uuid, values, relations),
        });
    }

    async create(
        organisation_uuid: string,
        dto: CreateReminderDto,
        opts?: {
            source?: ReminderSource;
            type?: ReminderType;
            outreach_message_uuid?: string;
            metadata?: Prisma.InputJsonValue;
            /** The member creating it; becomes the sole assignee unless `dto.assignee_user_uuids` says otherwise. */
            created_by_user_uuid?: string;
        },
    ): Promise<ReminderView> {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid: dto.contact_uuid, organisation_uuid },
        });
        if (!contact) throw new NotFoundException('Contact not found');

        const remindAt = new Date(dto.remind_at);
        if (remindAt <= new Date()) {
            throw new BadRequestException('Reminder date must be in the future');
        }

        const assigneeUuids = await this.resolveAssignees(
            organisation_uuid,
            dto.assignee_user_uuids ?? (opts?.created_by_user_uuid ? [opts.created_by_user_uuid] : []),
        );

        // Checked up front so a missing calendar connection doesn't leave a half-made reminder behind.
        const calendarConnection =
            dto.add_to_google_calendar && opts?.created_by_user_uuid
                ? await this.calendar.requireConnection(organisation_uuid, opts.created_by_user_uuid)
                : null;

        const created = await this.prisma.reminder.create({
            data: {
                organisation_uuid,
                contact_uuid: dto.contact_uuid,
                title: dto.title,
                notes: dto.notes,
                remind_at: remindAt,
                status: dto.status ?? ReminderStatus.PENDING,
                source: opts?.source ?? ReminderSource.MANUAL,
                type: opts?.type ?? ReminderType.GENERAL,
                outreach_message_uuid: opts?.outreach_message_uuid,
                metadata: opts?.metadata,
                assignees: { create: assigneeUuids.map((user_uuid) => ({ user_uuid })) },
            },
            include: REMINDER_INCLUDE,
        });
        let reminder = toView(created);

        const jobId = `reminder-${reminder.uuid}`;
        await this.reminderQueue.add(
            'trigger',
            { reminder_uuid: reminder.uuid },
            {
                delay: Math.max(0, remindAt.getTime() - Date.now()),
                jobId,
                attempts: 1,
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 86400 },
            },
        );

        await this.prisma.reminder.update({
            where: { uuid: reminder.uuid },
            data: { job_id: jobId },
        });

        if (calendarConnection && (await this.calendar.upsert(reminder, calendarConnection.uuid))) {
            reminder = await this.findOne(organisation_uuid, reminder.uuid);
        }

        await this.emitToRecipients(reminder, 'reminder.created');
        return reminder;
    }

    async findAll(organisation_uuid: string, query: ListRemindersDto) {
        const now = new Date();
        const where: Prisma.ReminderWhereInput = { organisation_uuid };
        const timezone = await this.resolveTimezone(organisation_uuid, query.timezone);

        if (query.contact_uuid) where.contact_uuid = query.contact_uuid;
        if (query.status) where.status = query.status;
        if (query.for_user_uuid) {
            // What this member receives: reminders assigned to them plus the ones for everyone.
            where.AND = [
                {
                    OR: [
                        { assignees: { some: { user_uuid: query.for_user_uuid } } },
                        { assignees: { none: {} } },
                    ],
                },
            ];
        }

        if (query.range === 'today') {
            // End of the day in the caller's timezone, not the server's.
            const end = DateTime.fromJSDate(now, { zone: timezone }).endOf('day').toJSDate();
            where.remind_at = { gte: now, lte: end };
            if (!query.status) where.status = ReminderStatus.PENDING;
        } else if (query.range === 'week') {
            const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            where.remind_at = { gte: now, lte: end };
            if (!query.status) where.status = ReminderStatus.PENDING;
        } else if (query.range === 'month') {
            const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            where.remind_at = { gte: now, lte: end };
            if (!query.status) where.status = ReminderStatus.PENDING;
        } else if (query.range === 'overdue') {
            where.remind_at = { lt: now };
            where.status = ReminderStatus.PENDING;
        }

        if (query.search) {
            const search = query.search;
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
                { contact: { name: { contains: search, mode: 'insensitive' } } },
                { contact: { company: { contains: search, mode: 'insensitive' } } },
                { contact: { email: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const sort = query.sort ?? 'remind_at_desc';
        let data;
        const total = await this.prisma.reminder.count({ where });

        if (sort === 'closest') {
            // Pending reminders that need action come first, ordered by how near their time is to now
            // (overdue and upcoming alike); finished ones follow in the same order.
            const candidates = await this.prisma.reminder.findMany({
                where,
                select: { uuid: true, remind_at: true, status: true },
            });
            const nowMs = now.getTime();
            const pageUuids = candidates
                .sort(
                    (a, b) =>
                        Number(a.status !== ReminderStatus.PENDING) - Number(b.status !== ReminderStatus.PENDING) ||
                        Math.abs(a.remind_at.getTime() - nowMs) - Math.abs(b.remind_at.getTime() - nowMs),
                )
                .slice(skip, skip + limit)
                .map((row) => row.uuid);
            const rows = await this.prisma.reminder.findMany({
                where: { uuid: { in: pageUuids } },
                include: REMINDER_INCLUDE,
            });
            const order = new Map(pageUuids.map((uuid, index) => [uuid, index]));
            data = rows.sort((a, b) => (order.get(a.uuid) ?? 0) - (order.get(b.uuid) ?? 0));
        } else {
            data = await this.prisma.reminder.findMany({
                where,
                include: REMINDER_INCLUDE,
                orderBy: { remind_at: sort === 'remind_at_asc' ? 'asc' : 'desc' },
                skip,
                take: limit,
            });
        }

        return { data: data.map(toView), total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /** The caller's IANA timezone when valid, otherwise the organisation's. */
    private async resolveTimezone(organisation_uuid: string, requested?: string): Promise<string> {
        if (requested && DateTime.now().setZone(requested).isValid) return requested;
        const org = await this.prisma.organisation.findUnique({
            where: { uuid: organisation_uuid },
            select: { timezone: true },
        });
        return org?.timezone ?? 'UTC';
    }

    async findOne(organisation_uuid: string, uuid: string): Promise<ReminderView> {
        const reminder = await this.prisma.reminder.findFirst({
            where: { uuid, organisation_uuid },
            include: REMINDER_INCLUDE,
        });
        if (!reminder) throw new NotFoundException('Reminder not found');
        return toView(reminder);
    }

    /**
     * Members who should get this reminder: its assignees that are still in the organisation, or every
     * member when it has none (or when all of its assignees have since left).
     */
    async getRecipientUserUuids(reminder: { organisation_uuid: string; assignees: { uuid?: string; user_uuid?: string }[] }) {
        const members = await this.prisma.organisationMember.findMany({
            where: { organisation_uuid: reminder.organisation_uuid },
            select: { user_uuid: true },
        });
        const everyone = members.map((m) => m.user_uuid);
        const assigned = new Set(reminder.assignees.map((a) => a.uuid ?? a.user_uuid));
        if (assigned.size === 0) return everyone;
        const stillMembers = everyone.filter((uuid) => assigned.has(uuid));
        return stillMembers.length ? stillMembers : everyone;
    }

    private async emitToRecipients(reminder: ReminderView, event: string) {
        const recipients = await this.getRecipientUserUuids(reminder);
        this.gateway.emitToUsers(recipients, event, reminder);
    }

    /** Every assignee must belong to the organisation; duplicates collapse. Empty = everyone. */
    private async resolveAssignees(organisation_uuid: string, user_uuids: string[]): Promise<string[]> {
        const unique = [...new Set(user_uuids)];
        if (unique.length === 0) return [];
        const count = await this.prisma.organisationMember.count({
            where: { organisation_uuid, user_uuid: { in: unique } },
        });
        if (count !== unique.length) {
            throw new BadRequestException('Every assignee must be a member of this organisation');
        }
        return unique;
    }

    async update(
        organisation_uuid: string,
        uuid: string,
        dto: UpdateReminderDto,
        /** The member making the change; their Google Calendar is used when adding the reminder to it. */
        actor_user_uuid?: string,
    ): Promise<ReminderView> {
        const existing = await this.prisma.reminder.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!existing) throw new NotFoundException('Reminder not found');

        const remindAt = dto.remind_at ? new Date(dto.remind_at) : undefined;
        if (remindAt && remindAt <= new Date()) {
            throw new BadRequestException('Reminder date must be in the future');
        }

        const addingToCalendar = dto.add_to_google_calendar === true && !existing.calendar_event_id;
        if (addingToCalendar && !actor_user_uuid) {
            throw new BadRequestException('Cannot add this reminder to a Google Calendar without a member');
        }
        const newConnection = addingToCalendar
            ? await this.calendar.requireConnection(organisation_uuid, actor_user_uuid!)
            : null;

        // Cancel job when completing/cancelling or rescheduling
        const isStatusChange = dto.status && dto.status !== ReminderStatus.PENDING;
        const isReschedule = !!remindAt && existing.status === ReminderStatus.PENDING;

        if (isStatusChange || isReschedule) {
            await this.cancelJob(existing.job_id);
        }

        let newJobId: string | undefined;
        if (isReschedule) {
            newJobId = `reminder-${uuid}`;
            await this.reminderQueue.add(
                'trigger',
                { reminder_uuid: uuid },
                {
                    delay: Math.max(0, remindAt!.getTime() - Date.now()),
                    jobId: newJobId,
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 86400 },
                },
            );
        }

        const assigneeUuids =
            dto.assignee_user_uuids !== undefined
                ? await this.resolveAssignees(organisation_uuid, dto.assignee_user_uuids)
                : undefined;

        const updated = await this.prisma.reminder.update({
            where: { uuid },
            data: {
                title: dto.title,
                notes: dto.notes,
                remind_at: remindAt,
                status: dto.status,
                ...(newJobId !== undefined && { job_id: newJobId }),
                ...(isStatusChange && { job_id: null }),
                ...(assigneeUuids !== undefined && {
                    assignees: { deleteMany: {}, create: assigneeUuids.map((user_uuid) => ({ user_uuid })) },
                }),
            },
            include: REMINDER_INCLUDE,
        });
        let reminder = toView(updated);

        // Keep the Google Calendar event in step: gone once the reminder is no longer pending or when
        // switched off, otherwise created / refreshed when it is on (or was added) and something changed.
        const hadEvent = !!existing.calendar_event_id;
        const calendarConnectionUuid = newConnection?.uuid ?? existing.calendar_connection_uuid;
        const calendarChanged =
            !!remindAt || dto.title !== undefined || dto.notes !== undefined;
        // A completed/cancelled reminder keeps its calendar connection (but not its event), which marks it
        // as one to put back on the calendar when it is reopened.
        const reopening =
            !hadEvent &&
            !!existing.calendar_connection_uuid &&
            existing.status !== ReminderStatus.PENDING &&
            updated.status === ReminderStatus.PENDING &&
            dto.add_to_google_calendar !== false;
        const switchedOff = dto.add_to_google_calendar === false;
        let calendarTouched = false;
        if (
            (hadEvent || (switchedOff && !!existing.calendar_connection_uuid)) &&
            (switchedOff || updated.status !== ReminderStatus.PENDING)
        ) {
            await this.calendar.remove(existing, { keep_connection: !switchedOff });
            calendarTouched = true;
        } else if (
            calendarConnectionUuid &&
            updated.status === ReminderStatus.PENDING &&
            (addingToCalendar || reopening || (hadEvent && calendarChanged))
        ) {
            calendarTouched = await this.calendar.upsert(reminder, calendarConnectionUuid);
        }
        if (calendarTouched) reminder = await this.findOne(organisation_uuid, uuid);

        const event =
            dto.status === ReminderStatus.COMPLETED
                ? 'reminder.completed'
                : 'reminder.updated';
        await this.emitToRecipients(reminder, event);
        return reminder;
    }

    async complete(organisation_uuid: string, uuid: string) {
        return this.update(organisation_uuid, uuid, { status: ReminderStatus.COMPLETED });
    }

    async remove(organisation_uuid: string, uuid: string) {
        const existing = await this.prisma.reminder.findFirst({
            where: { uuid, organisation_uuid },
            include: { assignees: { select: { user_uuid: true } } },
        });
        if (!existing) throw new NotFoundException('Reminder not found');

        // Resolve who to tell before the assignment rows are deleted along with the reminder.
        const recipients = await this.getRecipientUserUuids(existing);
        await this.cancelJob(existing.job_id);
        await this.calendar.remove(existing);
        await this.prisma.reminder.delete({ where: { uuid } });
        this.gateway.emitToUsers(recipients, 'reminder.deleted', { uuid });
        return { uuid };
    }

    async getUpcomingStats(organisation_uuid: string) {
        const now = new Date();
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const [pending, due_today, overdue, completed_this_week] = await Promise.all([
            this.prisma.reminder.count({
                where: { organisation_uuid, status: ReminderStatus.PENDING },
            }),
            this.prisma.reminder.count({
                where: {
                    organisation_uuid,
                    status: ReminderStatus.PENDING,
                    remind_at: { gte: now, lte: todayEnd },
                },
            }),
            this.prisma.reminder.count({
                where: {
                    organisation_uuid,
                    status: ReminderStatus.PENDING,
                    remind_at: { lt: now },
                },
            }),
            this.prisma.reminder.count({
                where: {
                    organisation_uuid,
                    status: ReminderStatus.COMPLETED,
                    updated_at: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
                },
            }),
        ]);

        return { pending, due_today, overdue, completed_this_week };
    }

    /**
     * Cancels the pending FOLLOW_UP reminder (if any) - "did they go quiet after we last
     * emailed them." Called when a reply arrives. Scoped to the conversation the reply landed
     * on when `thread_uuid` is known, so a reply on one thread doesn't silence the follow-up
     * for a different, still-quiet thread with the same contact; without it, falls back to the
     * contact's pending follow-up.
     */
    async cancelPendingFollowUp(
        organisation_uuid: string,
        contact_uuid: string,
        thread_uuid?: string | null,
    ): Promise<boolean> {
        const existing = await this.prisma.reminder.findFirst({
            where: {
                organisation_uuid,
                contact_uuid,
                type: ReminderType.FOLLOW_UP,
                status: ReminderStatus.PENDING,
                ...(thread_uuid && { outreach_message: { thread_uuid } }),
            },
        });
        if (!existing) return false;

        await this.update(organisation_uuid, existing.uuid, {
            status: ReminderStatus.CANCELLED,
        });
        return true;
    }

    /**
     * Reschedules the conversation's pending FOLLOW_UP reminder if one exists, otherwise
     * creates one - so there's at most one "check back if they're still quiet" reminder per
     * thread (per contact when the message has no thread). Called after a manual reply we send
     * (not automated sequence steps, which own their own advancement logic).
     */
    async upsertFollowUp(
        organisation_uuid: string,
        contact_uuid: string,
        outreach_message_uuid: string,
        remind_at: Date,
        thread_uuid?: string | null,
    ) {
        const existing = await this.prisma.reminder.findFirst({
            where: {
                organisation_uuid,
                contact_uuid,
                type: ReminderType.FOLLOW_UP,
                status: ReminderStatus.PENDING,
                ...(thread_uuid && { outreach_message: { thread_uuid } }),
            },
        });

        if (existing) {
            // Clearing metadata drops the AI draft written for the previous send - the new
            // trigger drafts a fresh follow-up against the updated conversation.
            await this.prisma.reminder.update({
                where: { uuid: existing.uuid },
                data: { outreach_message_uuid, metadata: Prisma.DbNull },
            });
            return this.update(organisation_uuid, existing.uuid, {
                remind_at: remind_at.toISOString(),
            });
        }

        return this.create(
            organisation_uuid,
            {
                contact_uuid,
                title: 'Follow up: no reply yet',
                remind_at: remind_at.toISOString(),
            },
            { source: ReminderSource.SYSTEM, type: ReminderType.FOLLOW_UP, outreach_message_uuid },
        );
    }

    /** Attaches an AI-drafted follow-up suggestion to a reminder without touching its schedule/status. */
    async setFollowUpDraft(
        uuid: string,
        ai_draft: { subject: string; body: string; generated_at: string },
    ) {
        return this.prisma.reminder.update({
            where: { uuid },
            data: { metadata: { ai_draft } as Prisma.InputJsonValue },
        });
    }

    /** Queues the trigger job for a pending reminder that is still in the future; returns its job id. */
    private async scheduleJob(uuid: string, status: ReminderStatus, remindAt: Date): Promise<string | null> {
        if (status !== ReminderStatus.PENDING || remindAt <= new Date()) return null;
        const jobId = `reminder-${uuid}`;
        await this.reminderQueue.add(
            'trigger',
            { reminder_uuid: uuid },
            {
                delay: remindAt.getTime() - Date.now(),
                jobId,
                attempts: 1,
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 86400 },
            },
        );
        return jobId;
    }

    /** Activity undo of a delete: puts the row and its assignees back and re-queues its job. The Google Calendar event is not recreated. */
    private async restoreFromSnapshot(
        organisation_uuid: string,
        snapshot: Record<string, unknown>,
        relations: Record<string, unknown>,
    ) {
        const assignees = (relations.assignees as { user_uuid: string }[] | undefined) ?? [];
        const remindAt = new Date(snapshot.remind_at as string);
        const status = snapshot.status as ReminderStatus;
        const uuid = snapshot.uuid as string;

        await this.prisma.reminder.create({
            data: {
                uuid,
                organisation_uuid,
                contact_uuid: snapshot.contact_uuid as string,
                title: (snapshot.title as string | null) ?? undefined,
                notes: (snapshot.notes as string | null) ?? undefined,
                remind_at: remindAt,
                status,
                source: snapshot.source as ReminderSource,
                type: snapshot.type as ReminderType,
                outreach_message_uuid: (snapshot.outreach_message_uuid as string | null) ?? undefined,
                metadata: (snapshot.metadata as Prisma.InputJsonValue | null) ?? undefined,
                assignees: { create: assignees.map(({ user_uuid }) => ({ user_uuid })) },
            },
        });

        const job_id = await this.scheduleJob(uuid, status, remindAt);
        if (job_id) await this.prisma.reminder.update({ where: { uuid }, data: { job_id } });

        await this.emitToRecipients(await this.findOne(organisation_uuid, uuid), 'reminder.created');
    }

    /** Activity undo of an edit: restores the changed fields, then re-syncs the trigger job with the result. */
    private async revertToValues(
        organisation_uuid: string,
        uuid: string,
        values: Record<string, unknown>,
        relations: Record<string, unknown> | undefined,
    ) {
        const existing = await this.prisma.reminder.findFirst({ where: { uuid, organisation_uuid } });
        if (!existing) throw new NotFoundException('Reminder not found');

        const remindAt = values.remind_at ? new Date(values.remind_at as string) : existing.remind_at;
        const status = (values.status as ReminderStatus | undefined) ?? existing.status;
        const assignees = relations?.assignees as { user_uuid: string }[] | undefined;

        await this.cancelJob(existing.job_id);
        const job_id = await this.scheduleJob(uuid, status, remindAt);

        await this.prisma.reminder.update({
            where: { uuid },
            data: {
                ...('title' in values && { title: values.title as string | null }),
                ...('notes' in values && { notes: values.notes as string | null }),
                ...('metadata' in values && {
                    metadata: (values.metadata as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
                }),
                remind_at: remindAt,
                status,
                job_id,
                ...(assignees && {
                    assignees: { deleteMany: {}, create: assignees.map(({ user_uuid }) => ({ user_uuid })) },
                }),
            },
        });

        await this.emitToRecipients(await this.findOne(organisation_uuid, uuid), 'reminder.updated');
    }

    private async cancelJob(job_id: string | null) {
        if (!job_id) return;
        try {
            const job = await this.reminderQueue.getJob(job_id);
            if (job) await job.remove();
        } catch {
            // Job may have already been processed or removed
        }
    }
}
