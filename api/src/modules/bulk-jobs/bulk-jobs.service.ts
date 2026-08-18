import { Injectable, NotFoundException } from '@nestjs/common';
import {
    BulkJobStatus,
    BulkJobType,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ListBulkJobsDto } from './dto/list-bulk-jobs.dto';

const ACTIVE_STATUSES: BulkJobStatus[] = [
    BulkJobStatus.PENDING,
    BulkJobStatus.QUEUED,
    BulkJobStatus.RUNNING,
];

export type CreateBulkJobInput = {
    organisation_uuid: string;
    created_by_user_uuid?: string | null;
    title: string;
    type: BulkJobType;
    status?: BulkJobStatus;
    progress_total?: number;
    progress_current?: number;
    queue_name?: string | null;
    queue_job_id?: string | null;
    reference_type?: string | null;
    reference_uuid?: string | null;
    metadata?: Prisma.InputJsonValue;
    max_retries?: number;
    started_at?: Date | null;
};

@Injectable()
export class BulkJobsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(organisation_uuid: string, query: ListBulkJobsDto) {
        const where: Prisma.BulkJobWhereInput = { organisation_uuid };

        if (query.status) {
            where.status = query.status;
        } else if (query.active_only !== false) {
            where.status = { in: ACTIVE_STATUSES };
        }

        if (query.type) {
            where.type = query.type;
        }

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.bulkJob.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.bulkJob.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const job = await this.prisma.bulkJob.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!job) {
            throw new NotFoundException('Bulk job not found');
        }
        return job;
    }

    create(input: CreateBulkJobInput) {
        const status = input.status ?? BulkJobStatus.PENDING;
        return this.prisma.bulkJob.create({
            data: {
                organisation_uuid: input.organisation_uuid,
                created_by_user_uuid: input.created_by_user_uuid ?? null,
                title: input.title,
                type: input.type,
                status,
                progress_total: input.progress_total ?? 0,
                progress_current: input.progress_current ?? 0,
                queue_name: input.queue_name ?? null,
                queue_job_id: input.queue_job_id ?? null,
                reference_type: input.reference_type ?? null,
                reference_uuid: input.reference_uuid ?? null,
                metadata: input.metadata ?? undefined,
                max_retries: input.max_retries ?? 3,
                started_at:
                    input.started_at !== undefined
                        ? input.started_at
                        : status === BulkJobStatus.RUNNING
                          ? new Date()
                          : null,
            },
        });
    }

    async markRunning(uuid: string, extra?: { queue_job_id?: string | null }) {
        return this.prisma.bulkJob.update({
            where: { uuid },
            data: {
                status: BulkJobStatus.RUNNING,
                started_at: new Date(),
                ...(extra?.queue_job_id !== undefined
                    ? { queue_job_id: extra.queue_job_id }
                    : {}),
            },
        });
    }

    async incrementProgress(uuid: string) {
        const updated = await this.prisma.bulkJob.update({
            where: { uuid },
            data: { progress_current: { increment: 1 } },
        });
        return updated;
    }

    async incrementFailure(uuid: string) {
        const updated = await this.prisma.bulkJob.update({
            where: { uuid },
            data: { progress_failed: { increment: 1 } },
        });
        return updated;
    }

    async complete(uuid: string, error?: string | null) {
        return this.prisma.bulkJob.update({
            where: { uuid },
            data: {
                status: BulkJobStatus.COMPLETED,
                completed_at: new Date(),
                ...(error ? { error } : {}),
            },
        });
    }

    async fail(uuid: string, error: string) {
        return this.prisma.bulkJob.update({
            where: { uuid },
            data: {
                status: BulkJobStatus.FAILED,
                error: error.slice(0, 4000),
                completed_at: new Date(),
            },
        });
    }

    async cancel(uuid: string, error = 'Cancelled') {
        return this.prisma.bulkJob.updateMany({
            where: {
                uuid,
                status: { in: ACTIVE_STATUSES },
            },
            data: {
                status: BulkJobStatus.CANCELLED,
                error: error.slice(0, 4000),
                completed_at: new Date(),
            },
        });
    }

    async updateByReference(
        organisation_uuid: string,
        reference_type: string,
        reference_uuid: string,
        data: Prisma.BulkJobUpdateManyMutationInput,
    ) {
        return this.prisma.bulkJob.updateMany({
            where: {
                organisation_uuid,
                reference_type,
                reference_uuid,
                status: { in: ACTIVE_STATUSES },
            },
            data,
        });
    }
}
