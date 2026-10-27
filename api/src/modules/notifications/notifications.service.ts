import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { NotificationsGateway } from '@/gateways/notifications.gateway';
import { ListNotificationsDto } from './dto/list-notifications.dto';

export interface CreateNotificationInput {
    organisation_uuid: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    entity_type?: string;
    entity_uuid?: string;
    data?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: NotificationsGateway,
    ) {}

    /** Stores one notification per recipient and pushes each to that member's open sessions. */
    async notifyUsers(user_uuids: string[], input: CreateNotificationInput): Promise<Notification[]> {
        const recipients = [...new Set(user_uuids)];
        if (recipients.length === 0) return [];
        const created = await this.prisma.$transaction(
            recipients.map((user_uuid) =>
                this.prisma.notification.create({
                    data: {
                        organisation_uuid: input.organisation_uuid,
                        user_uuid,
                        type: input.type,
                        title: input.title,
                        body: input.body ?? null,
                        entity_type: input.entity_type ?? null,
                        entity_uuid: input.entity_uuid ?? null,
                        data: input.data,
                    },
                }),
            ),
        );
        for (const notification of created) {
            this.gateway.emitToUser(notification.user_uuid, 'notification.created', notification);
        }
        return created;
    }

    /** Never lets a failed notification undo or fail the change that triggered it. */
    async notifyUsersSafely(user_uuids: string[], input: CreateNotificationInput): Promise<void> {
        try {
            await this.notifyUsers(user_uuids, input);
        } catch (error) {
            this.logger.error(`Could not create ${input.type} notification: ${(error as Error).message}`);
        }
    }

    async findAll(organisation_uuid: string, user_uuid: string, query: ListNotificationsDto) {
        const where: Prisma.NotificationWhereInput = { organisation_uuid, user_uuid };
        if (query.unread_only) where.read_at = null;
        if (query.type) where.type = query.type;

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const [data, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.notification.count({ where }),
        ]);
        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async unreadCount(organisation_uuid: string, user_uuid: string) {
        const count = await this.prisma.notification.count({
            where: { organisation_uuid, user_uuid, read_at: null },
        });
        return { count };
    }

    async markRead(organisation_uuid: string, user_uuid: string, uuid: string) {
        const existing = await this.prisma.notification.findFirst({ where: { uuid, organisation_uuid, user_uuid } });
        if (!existing) throw new NotFoundException('Notification not found');
        if (existing.read_at) return existing;
        return this.prisma.notification.update({ where: { uuid }, data: { read_at: new Date() } });
    }

    async markAllRead(organisation_uuid: string, user_uuid: string) {
        const result = await this.prisma.notification.updateMany({
            where: { organisation_uuid, user_uuid, read_at: null },
            data: { read_at: new Date() },
        });
        return { updated: result.count };
    }

    async remove(organisation_uuid: string, user_uuid: string, uuid: string) {
        const result = await this.prisma.notification.deleteMany({ where: { uuid, organisation_uuid, user_uuid } });
        if (result.count === 0) throw new NotFoundException('Notification not found');
        return { uuid };
    }
}
