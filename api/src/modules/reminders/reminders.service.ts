import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, ReminderSource, ReminderStatus, ReminderType } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { REMINDER_TRIGGER_QUEUE } from '@/core/queues/queues.constants';
import { NotificationsGateway } from '@/gateways/notifications.gateway';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ListRemindersDto } from './dto/list-reminders.dto';

const CONTACT_SELECT = {
    uuid: true,
    name: true,
    company: true,
    email: true,
} satisfies Prisma.ContactSelect;

@Injectable()
export class RemindersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: NotificationsGateway,
        @InjectQueue(REMINDER_TRIGGER_QUEUE) private readonly reminderQueue: Queue,
    ) {}

    async create(
        organisation_uuid: string,
        dto: CreateReminderDto,
        opts?: { source?: ReminderSource; type?: ReminderType },
    ) {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid: dto.contact_uuid, organisation_uuid },
        });
        if (!contact) throw new NotFoundException('Contact not found');

        const remindAt = new Date(dto.remind_at);
        if (remindAt <= new Date()) {
            throw new BadRequestException('Reminder date must be in the future');
        }

        const reminder = await this.prisma.reminder.create({
            data: {
                organisation_uuid,
                contact_uuid: dto.contact_uuid,
                title: dto.title,
                notes: dto.notes,
                remind_at: remindAt,
                status: dto.status ?? ReminderStatus.PENDING,
                source: opts?.source ?? ReminderSource.MANUAL,
                type: opts?.type ?? ReminderType.GENERAL,
            },
            include: { contact: { select: CONTACT_SELECT } },
        });

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

        this.gateway.emitToUser(organisation_uuid, 'reminder.created', reminder);
        return reminder;
    }

    async findAll(organisation_uuid: string, query: ListRemindersDto) {
        const now = new Date();
        const where: Prisma.ReminderWhereInput = { organisation_uuid };

        if (query.contact_uuid) where.contact_uuid = query.contact_uuid;
        if (query.status) where.status = query.status;

        if (query.range === 'today') {
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);
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

        const [data, total] = await Promise.all([
            this.prisma.reminder.findMany({
                where,
                include: { contact: { select: CONTACT_SELECT } },
                orderBy: { remind_at: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.reminder.count({ where }),
        ]);

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const reminder = await this.prisma.reminder.findFirst({
            where: { uuid, organisation_uuid },
            include: { contact: { select: CONTACT_SELECT } },
        });
        if (!reminder) throw new NotFoundException('Reminder not found');
        return reminder;
    }

    async update(organisation_uuid: string, uuid: string, dto: UpdateReminderDto) {
        const existing = await this.prisma.reminder.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!existing) throw new NotFoundException('Reminder not found');

        const remindAt = dto.remind_at ? new Date(dto.remind_at) : undefined;
        if (remindAt && remindAt <= new Date()) {
            throw new BadRequestException('Reminder date must be in the future');
        }

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

        const reminder = await this.prisma.reminder.update({
            where: { uuid },
            data: {
                title: dto.title,
                notes: dto.notes,
                remind_at: remindAt,
                status: dto.status,
                ...(newJobId !== undefined && { job_id: newJobId }),
                ...(isStatusChange && { job_id: null }),
            },
            include: { contact: { select: CONTACT_SELECT } },
        });

        const event =
            dto.status === ReminderStatus.COMPLETED
                ? 'reminder.completed'
                : 'reminder.updated';
        this.gateway.emitToUser(organisation_uuid, event, reminder);
        return reminder;
    }

    async complete(organisation_uuid: string, uuid: string) {
        return this.update(organisation_uuid, uuid, { status: ReminderStatus.COMPLETED });
    }

    async remove(organisation_uuid: string, uuid: string) {
        const existing = await this.prisma.reminder.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!existing) throw new NotFoundException('Reminder not found');

        await this.cancelJob(existing.job_id);
        await this.prisma.reminder.delete({ where: { uuid } });
        this.gateway.emitToUser(organisation_uuid, 'reminder.deleted', { uuid });
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
