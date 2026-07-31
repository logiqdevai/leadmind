import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ListActivityLogsDto } from './dto/list-activity-logs.dto';
import { CreateActivityLogInput } from './interfaces/activity-log.interface';

@Injectable()
export class ActivityLogsService {
    private readonly logger = new Logger(ActivityLogsService.name);

    constructor(private readonly prisma: PrismaService) {}

    log(input: CreateActivityLogInput): void {
        if (!input.organisation_uuid) {
            return;
        }

        setImmediate(async () => {
            try {
                await this.prisma.activityLog.create({
                    data: {
                        organisation_uuid: input.organisation_uuid,
                        actor_user_uuid: input.actor_user_uuid ?? null,
                        entity_type: input.entity_type,
                        entity_uuid: input.entity_uuid ?? null,
                        action: input.action,
                        summary: input.summary ?? null,
                        metadata: (input.metadata ?? undefined) as
                            | Prisma.InputJsonValue
                            | undefined,
                    },
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to persist activity log: ${message}`);
            }
        });
    }

    async findAll(organisation_uuid: string, query: ListActivityLogsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const search = query.search?.trim();

        const where: Prisma.ActivityLogWhereInput = {
            organisation_uuid,
            ...(query.entity_type && { entity_type: query.entity_type }),
            ...(query.action && { action: query.action }),
            ...(query.actor_user_uuid && { actor_user_uuid: query.actor_user_uuid }),
            ...((query.from || query.to) && {
                created_at: {
                    ...(query.from && { gte: new Date(query.from) }),
                    ...(query.to && { lte: new Date(query.to) }),
                },
            }),
            ...(search && {
                OR: [
                    { summary: { contains: search, mode: 'insensitive' } },
                    { action: { contains: search, mode: 'insensitive' } },
                    { entity_type: { contains: search, mode: 'insensitive' } },
                    { entity_uuid: { contains: search, mode: 'insensitive' } },
                    {
                        actor: {
                            OR: [
                                { full_name: { contains: search, mode: 'insensitive' } },
                                { email: { contains: search, mode: 'insensitive' } },
                            ],
                        },
                    },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.activityLog.findMany({
                where,
                include: {
                    actor: {
                        select: {
                            uuid: true,
                            full_name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.activityLog.count({ where }),
        ]);

        const total_pages = Math.ceil(total / limit) || 1;

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                total_pages,
                has_next: page < total_pages,
                has_prev: page > 1,
            },
        };
    }
}
