import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobType, Queue } from 'bullmq';
import {
    BulkJobStatus,
    BulkJobType,
    EnrichmentSource,
    JobStatus,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
    AI_PROCESS_QUEUE,
    FILTER_SCRAPE_QUEUE,
    MARKETING_CAMPAIGN_DISPATCH_QUEUE,
    MARKETING_MESSAGE_SEND_QUEUE,
    OUTREACH_SEND_QUEUE,
} from '@/core/queues/queues.constants';
import { enqueueContactEnrichmentJobs } from '@/modules/contacts/utils/contact-enrichment-queue.utils';
import { enqueueContactScoreJobs } from '@/modules/contacts/utils/contact-score-queue.utils';
import { enqueueLeadEnrichmentJob } from '@/modules/leads/utils/lead-enrichment-queue.utils';
import { abortFilterScrape } from '@/workers/utils/filter-scrape-cancel.registry';
import { ListBulkJobsDto } from './dto/list-bulk-jobs.dto';
import {
    bulkJobUuidFromQueueData,
    itemUuidFromQueueData,
    metadataObject,
    queueJobIdsFromMetadata,
    stringArrayFromMetadata,
} from './utils/bulk-job-queue.utils';

const ACTIVE_STATUSES: BulkJobStatus[] = [
    BulkJobStatus.PENDING,
    BulkJobStatus.QUEUED,
    BulkJobStatus.RUNNING,
];

const RETRYABLE_STATUSES: BulkJobStatus[] = [
    BulkJobStatus.CANCELLED,
    BulkJobStatus.FAILED,
];

const RESUMABLE_TYPES = new Set<BulkJobType>([
    BulkJobType.CONTACT_SCORE,
    BulkJobType.CONTACT_ENRICH,
    BulkJobType.LEAD_ENRICH,
]);

const CONTACT_BULK_TYPES_FOR_FINALIZE = new Set<BulkJobType>([
    BulkJobType.CONTACT_SCORE,
    BulkJobType.CONTACT_ENRICH,
]);

const QUEUE_REMOVE_STATES: JobType[] = [
    'wait',
    'waiting',
    'delayed',
    'paused',
    'prioritized',
    'waiting-children',
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

export type BulkJobActionResult = {
    uuid: string;
    ok: boolean;
    error?: string;
};

@Injectable()
export class BulkJobsService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(AI_PROCESS_QUEUE) private readonly aiProcessQueue: Queue,
        @InjectQueue(FILTER_SCRAPE_QUEUE) private readonly filterScrapeQueue: Queue,
        @InjectQueue(OUTREACH_SEND_QUEUE) private readonly outreachSendQueue: Queue,
        @InjectQueue(MARKETING_CAMPAIGN_DISPATCH_QUEUE)
        private readonly campaignDispatchQueue: Queue,
        @InjectQueue(MARKETING_MESSAGE_SEND_QUEUE)
        private readonly campaignSendQueue: Queue,
    ) {}

    async findAll(organisation_uuid: string | null, query: ListBulkJobsDto) {
        const where: Prisma.BulkJobWhereInput = {};
        if (organisation_uuid) {
            where.organisation_uuid = organisation_uuid;
        }

        if (query.status) {
            where.status = query.status;
        } else if (query.active_only) {
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
                ...(!organisation_uuid
                    ? { include: { organisation: { select: { uuid: true, name: true } } } }
                    : {}),
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

    async markRunning(uuid: string, extra?: { queue_job_id?: string | null; queue_job_ids?: string[] }) {
        const data: Prisma.BulkJobUpdateInput = {
            status: BulkJobStatus.RUNNING,
            started_at: new Date(),
        };
        if (extra?.queue_job_id !== undefined) {
            data.queue_job_id = extra.queue_job_id;
        }
        if (extra?.queue_job_ids?.length) {
            const existing = await this.prisma.bulkJob.findUnique({
                where: { uuid },
                select: { metadata: true },
            });
            const metadata = metadataObject(existing?.metadata);
            data.metadata = {
                ...metadata,
                queue_job_ids: extra.queue_job_ids,
            };
            if (extra.queue_job_id === undefined) {
                data.queue_job_id = extra.queue_job_ids[0] ?? null;
            }
        }
        return this.prisma.bulkJob.update({
            where: { uuid },
            data,
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

    async recordItemOutcome(
        uuid: string,
        opts: { failed: boolean; item_uuid?: string },
    ): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT uuid FROM bulk_jobs WHERE uuid = ${uuid} FOR UPDATE`;
            const existing = await tx.bulkJob.findUnique({ where: { uuid } });
            if (!existing || !ACTIVE_STATUSES.includes(existing.status)) {
                return;
            }

            const metadata = metadataObject(existing.metadata);
            const processed = new Set(stringArrayFromMetadata(metadata, 'processed_uuids'));
            if (opts.item_uuid) {
                if (processed.has(opts.item_uuid)) {
                    return;
                }
                processed.add(opts.item_uuid);
            }

            const expected = Math.max(
                existing.progress_total,
                stringArrayFromMetadata(metadata, 'contact_uuids').length,
                stringArrayFromMetadata(metadata, 'lead_uuids').length,
            );
            const progress_current = opts.item_uuid
                ? processed.size
                : existing.progress_current + 1;
            const progress_failed = existing.progress_failed + (opts.failed ? 1 : 0);
            const data: Prisma.BulkJobUpdateInput = {
                progress_current,
                progress_failed,
                metadata: {
                    ...metadata,
                    ...(opts.item_uuid ? { processed_uuids: [...processed] } : {}),
                },
            };

            const doneCount = opts.item_uuid ? processed.size : progress_current;
            if (expected > 0 && doneCount >= expected) {
                data.completed_at = new Date();
                if (progress_failed >= expected) {
                    data.status = BulkJobStatus.FAILED;
                    data.error = `All ${expected} items failed`;
                } else {
                    data.status = BulkJobStatus.COMPLETED;
                    if (progress_failed > 0) {
                        data.error = `${progress_failed}/${expected} items failed`;
                    }
                }
            }

            await tx.bulkJob.update({ where: { uuid }, data });
        });
    }

    async finalizeIncomplete(job: {
        uuid: string;
        type?: BulkJobType;
        progress_current: number;
        progress_total: number;
        metadata?: unknown;
    }): Promise<void> {
        const metadata = metadataObject(job.metadata);
        const processed = stringArrayFromMetadata(metadata, 'processed_uuids').length;
        const expected = Math.max(
            job.progress_total,
            stringArrayFromMetadata(metadata, 'contact_uuids').length,
            stringArrayFromMetadata(metadata, 'lead_uuids').length,
        );
        const at = `${Math.max(job.progress_current, processed)}/${expected || job.progress_total}`;

        if (expected > 0 && processed >= expected) {
            await this.complete(job.uuid);
            return;
        }
        if (job.progress_current >= job.progress_total && job.progress_total > 0 && processed >= job.progress_total) {
            await this.complete(job.uuid);
            return;
        }
        if (CONTACT_BULK_TYPES_FOR_FINALIZE.has(job.type as BulkJobType) && processed < expected) {
            await this.fail(
                job.uuid,
                `Stopped early with ${processed}/${expected} contacts processed`,
            );
            return;
        }
        if (job.progress_current > 0 || processed > 0) {
            await this.complete(job.uuid, `Finished with ${at} items recorded`);
            return;
        }
        await this.fail(job.uuid, 'Stopped with no progress');
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

    async cancelMany(
        organisation_uuid: string,
        uuids: string[],
    ): Promise<{ results: BulkJobActionResult[] }> {
        const unique = [...new Set(uuids)];
        const results: BulkJobActionResult[] = [];
        for (const uuid of unique) {
            try {
                await this.cancelOwned(organisation_uuid, uuid);
                results.push({ uuid, ok: true });
            } catch (error) {
                results.push({
                    uuid,
                    ok: false,
                    error: error instanceof Error ? error.message : 'Cancel failed',
                });
            }
        }
        return { results };
    }

    async retryMany(
        organisation_uuid: string,
        uuids: string[],
    ): Promise<{ results: BulkJobActionResult[] }> {
        const unique = [...new Set(uuids)];
        const results: BulkJobActionResult[] = [];
        for (const uuid of unique) {
            try {
                await this.retryOwned(organisation_uuid, uuid);
                results.push({ uuid, ok: true });
            } catch (error) {
                results.push({
                    uuid,
                    ok: false,
                    error: error instanceof Error ? error.message : 'Retry failed',
                });
            }
        }
        return { results };
    }

    private async cancelOwned(organisation_uuid: string, uuid: string): Promise<void> {
        const job = await this.findOne(organisation_uuid, uuid);
        if (!ACTIVE_STATUSES.includes(job.status)) {
            throw new BadRequestException('Only pending, queued, or running jobs can be cancelled');
        }

        const remaining = await this.collectRemainingItemUuids(job);
        await this.removeQueueWork(job);

        if (job.type === BulkJobType.FILTER_SCRAPE) {
            await this.cancelFilterScrapeSideEffects(job);
        }

        const metadata = metadataObject(job.metadata);
        if (remaining.length > 0) {
            metadata.remaining_uuids = remaining;
        }

        await this.prisma.bulkJob.update({
            where: { uuid: job.uuid },
            data: {
                status: BulkJobStatus.CANCELLED,
                error: 'Stopped by user',
                completed_at: new Date(),
                queue_job_id: null,
                metadata: metadata as Prisma.InputJsonValue,
            },
        });
    }

    private async retryOwned(organisation_uuid: string, uuid: string): Promise<void> {
        const job = await this.findOne(organisation_uuid, uuid);
        if (!RETRYABLE_STATUSES.includes(job.status)) {
            throw new BadRequestException('Only cancelled or failed jobs can be retried');
        }
        if (!RESUMABLE_TYPES.has(job.type)) {
            throw new BadRequestException(`Retry is not supported for ${job.type} jobs`);
        }
        if (job.progress_total > 0 && job.progress_current >= job.progress_total) {
            throw new BadRequestException('Job already finished all items');
        }

        const remaining = this.resolveRemainingItemUuids(job);
        if (remaining.length === 0) {
            throw new BadRequestException('No remaining items to retry');
        }

        const metadata = metadataObject(job.metadata);
        delete metadata.remaining_uuids;
        delete metadata.queue_job_ids;

        await this.prisma.bulkJob.update({
            where: { uuid: job.uuid },
            data: {
                status: BulkJobStatus.QUEUED,
                error: null,
                completed_at: null,
                retries: { increment: 1 },
                queue_job_id: null,
                metadata: metadata as Prisma.InputJsonValue,
            },
        });

        const jobIds = await this.enqueueRemaining(job, remaining);
        if (jobIds.length === 0) {
            await this.fail(job.uuid, 'Retry queued no work');
            throw new BadRequestException('Retry queued no work');
        }

        await this.markRunning(job.uuid, {
            queue_job_id: jobIds[0] ?? null,
            queue_job_ids: jobIds,
        });
    }

    private resolveRemainingItemUuids(job: {
        type: BulkJobType;
        progress_current: number;
        metadata: unknown;
    }): string[] {
        const metadata = metadataObject(job.metadata);
        const remainingStored = stringArrayFromMetadata(metadata, 'remaining_uuids');
        if (remainingStored.length > 0) return remainingStored;

        const all = this.itemUuidsFromMetadata(job.type, metadata);
        const processed = new Set(stringArrayFromMetadata(metadata, 'processed_uuids'));
        if (processed.size > 0) {
            return all.filter((uuid) => !processed.has(uuid));
        }
        if (job.progress_current > 0 && job.progress_current < all.length) {
            return all.slice(job.progress_current);
        }
        return all;
    }

    private itemUuidsFromMetadata(
        type: BulkJobType,
        metadata: Record<string, unknown>,
    ): string[] {
        if (type === BulkJobType.LEAD_ENRICH) {
            return stringArrayFromMetadata(metadata, 'lead_uuids');
        }
        return stringArrayFromMetadata(metadata, 'contact_uuids');
    }

    private async collectRemainingItemUuids(job: {
        uuid: string;
        type: BulkJobType;
        progress_current: number;
        queue_name: string | null;
        metadata: unknown;
    }): Promise<string[]> {
        if (!RESUMABLE_TYPES.has(job.type)) return [];
        const queue = this.queueByName(job.queue_name);
        if (queue) {
            const pending = await this.listQueueJobsForBulk(queue, job.uuid);
            const fromQueue = pending
                .map((queued) => itemUuidFromQueueData(queued.data))
                .filter((uuid): uuid is string => Boolean(uuid));
            if (fromQueue.length > 0) {
                return [...new Set(fromQueue)];
            }
        }
        return this.resolveRemainingItemUuids(job);
    }

    private async enqueueRemaining(
        job: { uuid: string; type: BulkJobType; metadata: unknown },
        remaining: string[],
    ): Promise<string[]> {
        const metadata = metadataObject(job.metadata);
        if (job.type === BulkJobType.CONTACT_SCORE) {
            const instructionUuids = stringArrayFromMetadata(
                metadata,
                'scoring_instruction_uuids',
            );
            const { jobIds } = await enqueueContactScoreJobs(
                this.aiProcessQueue,
                this.prisma,
                remaining.map((contactUuid) => ({
                    contactUuid,
                    allowed: instructionUuids,
                    scoringInstructionUuidsRequested: instructionUuids,
                })),
                job.uuid,
            );
            return jobIds;
        }
        if (job.type === BulkJobType.CONTACT_ENRICH) {
            const sources = stringArrayFromMetadata(metadata, 'sources') as EnrichmentSource[];
            const { jobIds } = await enqueueContactEnrichmentJobs(
                this.aiProcessQueue,
                remaining.map((contactUuid) => ({
                    contactUuid,
                    enrichment_sources: sources,
                })),
                job.uuid,
            );
            return jobIds;
        }
        if (job.type === BulkJobType.LEAD_ENRICH) {
            const sources = stringArrayFromMetadata(metadata, 'sources') as EnrichmentSource[];
            const jobs = await Promise.all(
                remaining.map((leadUuid) =>
                    enqueueLeadEnrichmentJob(
                        this.aiProcessQueue,
                        leadUuid,
                        sources,
                        job.uuid,
                    ),
                ),
            );
            return jobs.map((row) => row.jobId);
        }
        return [];
    }

    private async removeQueueWork(job: {
        uuid: string;
        queue_name: string | null;
        queue_job_id: string | null;
        metadata: unknown;
    }): Promise<void> {
        const queue = this.queueByName(job.queue_name);
        if (!queue) return;

        const trackedIds = new Set<string>(queueJobIdsFromMetadata(job.metadata));
        if (job.queue_job_id) trackedIds.add(job.queue_job_id);

        for (const queueJobId of trackedIds) {
            try {
                const queued = await queue.getJob(queueJobId);
                if (queued) await queued.remove();
            } catch {
            }
        }

        const pending = await this.listQueueJobsForBulk(queue, job.uuid);
        for (const queued of pending) {
            try {
                await queued.remove();
            } catch {
            }
        }
    }

    private async listQueueJobsForBulk(queue: Queue, bulkJobUuid: string) {
        const batches = await Promise.all(
            QUEUE_REMOVE_STATES.map((state) =>
                queue.getJobs([state], 0, 10_000).catch(() => []),
            ),
        );
        const seen = new Set<string>();
        const matched = [];
        for (const jobs of batches) {
            for (const queued of jobs) {
                const id = String(queued.id);
                if (seen.has(id)) continue;
                seen.add(id);
                if (bulkJobUuidFromQueueData(queued.data) === bulkJobUuid) {
                    matched.push(queued);
                }
            }
        }
        return matched;
    }

    private async cancelFilterScrapeSideEffects(job: {
        reference_type: string | null;
        reference_uuid: string | null;
        metadata: unknown;
    }): Promise<void> {
        const filterUuid = metadataObject(job.metadata).filter_uuid;
        if (typeof filterUuid === 'string' && filterUuid) {
            abortFilterScrape(filterUuid);
        }
        if (job.reference_type === 'filter_job' && job.reference_uuid) {
            await this.prisma.filterJob.updateMany({
                where: {
                    uuid: job.reference_uuid,
                    status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
                },
                data: {
                    status: JobStatus.CANCELLED,
                    error: 'Stopped by user',
                    completed_at: new Date(),
                },
            });
        }
    }

    private queueByName(queueName: string | null): Queue | null {
        switch (queueName) {
            case AI_PROCESS_QUEUE:
                return this.aiProcessQueue;
            case FILTER_SCRAPE_QUEUE:
                return this.filterScrapeQueue;
            case OUTREACH_SEND_QUEUE:
                return this.outreachSendQueue;
            case MARKETING_CAMPAIGN_DISPATCH_QUEUE:
                return this.campaignDispatchQueue;
            case MARKETING_MESSAGE_SEND_QUEUE:
                return this.campaignSendQueue;
            default:
                return null;
        }
    }

    createOpenAiMirror(input: {
        organisation_uuid: string;
        batch_id: string;
        title: string;
        total_requests: number;
    }) {
        return this.create({
            organisation_uuid: input.organisation_uuid,
            title: input.title,
            type: BulkJobType.OPENAI_BATCH,
            status: BulkJobStatus.RUNNING,
            progress_total: input.total_requests,
            progress_current: 0,
            reference_type: 'openai_batch',
            reference_uuid: input.batch_id,
            metadata: { batch_id: input.batch_id },
            started_at: new Date(),
        });
    }

    async finishOpenAiMirror(
        organisation_uuid: string,
        batch_id: string,
        opts: { failed: boolean; error?: string },
    ) {
        if (opts.failed) {
            return this.updateByReference(organisation_uuid, 'openai_batch', batch_id, {
                status: BulkJobStatus.FAILED,
                error: (opts.error ?? 'OpenAI batch failed').slice(0, 4000),
                completed_at: new Date(),
            });
        }
        return this.updateByReference(organisation_uuid, 'openai_batch', batch_id, {
            status: BulkJobStatus.COMPLETED,
            completed_at: new Date(),
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
