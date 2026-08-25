import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, JobType, Queue } from 'bullmq';
import { BulkJobStatus, BulkJobType } from '@/generated/prisma';
import { BulkJobsService } from '@/modules/bulk-jobs/bulk-jobs.service';
import {
    bulkJobUuidFromQueueData,
    queueJobIdsFromMetadata,
} from '@/modules/bulk-jobs/utils/bulk-job-queue.utils';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
    AI_PROCESS_JOB_TIMEOUT_MS,
    AI_PROCESS_QUEUE,
    BULK_JOB_STALL_MS,
    FILTER_SCRAPE_LOCK_DURATION_MS,
    FILTER_SCRAPE_QUEUE,
    MARKETING_CAMPAIGN_DISPATCH_QUEUE,
    MARKETING_MESSAGE_SEND_QUEUE,
    OUTREACH_SEND_QUEUE,
} from '@/core/queues/queues.constants';

const QUEUE_SCAN_STATES: JobType[] = [
    'wait',
    'waiting',
    'delayed',
    'paused',
    'active',
    'prioritized',
    'waiting-children',
];

const LIVE_JOB_STATES: readonly string[] = [...QUEUE_SCAN_STATES, 'stalled'];

const ACTIVE: BulkJobStatus[] = [
    BulkJobStatus.PENDING,
    BulkJobStatus.QUEUED,
    BulkJobStatus.RUNNING,
];

const CONTACT_BULK_TYPES = new Set<BulkJobType>([
    BulkJobType.CONTACT_ENRICH,
    BulkJobType.CONTACT_SCORE,
]);

@Injectable()
export class BulkJobWatchdogService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BulkJobWatchdogService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private running = false;
    private lastProgress = new Map<string, { current: number; seenAt: number }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly bulkJobsService: BulkJobsService,
        @InjectQueue(AI_PROCESS_QUEUE) private readonly aiProcessQueue: Queue,
        @InjectQueue(FILTER_SCRAPE_QUEUE) private readonly filterScrapeQueue: Queue,
        @InjectQueue(OUTREACH_SEND_QUEUE) private readonly outreachSendQueue: Queue,
        @InjectQueue(MARKETING_CAMPAIGN_DISPATCH_QUEUE)
        private readonly campaignDispatchQueue: Queue,
        @InjectQueue(MARKETING_MESSAGE_SEND_QUEUE)
        private readonly campaignSendQueue: Queue,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.reconcile();
        this.timer = setInterval(() => {
            this.reconcile().catch((error) => {
                this.logger.error(
                    `Bulk job reconcile failed: ${error instanceof Error ? error.message : error}`,
                );
            });
        }, 30_000);
        this.timer.unref?.();
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async reconcile(): Promise<void> {
        if (this.running) return;
        this.running = true;
        try {
            const liveByQueue = await this.collectLiveBulkUuids();
            const jobs = await this.prisma.bulkJob.findMany({
                where: { status: { in: ACTIVE } },
                select: {
                    uuid: true,
                    type: true,
                    queue_name: true,
                    queue_job_id: true,
                    progress_current: true,
                    progress_total: true,
                    updated_at: true,
                    metadata: true,
                },
            });
            const now = Date.now();
            let closed = 0;
            for (const job of jobs) {
                const progressSnapshot = this.lastProgress.get(job.uuid);
                if (
                    !progressSnapshot ||
                    progressSnapshot.current !== job.progress_current
                ) {
                    this.lastProgress.set(job.uuid, {
                        current: job.progress_current,
                        seenAt: now,
                    });
                }

                const live = await this.isLive(job, liveByQueue);
                if (live) continue;

                const progressIdleMs =
                    now - (this.lastProgress.get(job.uuid)?.seenAt ?? job.updated_at.getTime());
                const stallMs = stallMsFor(job.type, job.progress_total);

                if (progressIdleMs < stallMs) continue;

                if (
                    CONTACT_BULK_TYPES.has(job.type) &&
                    job.progress_current > 0 &&
                    job.progress_current < job.progress_total
                ) {
                    this.logger.warn(
                        `Closing stalled contact bulk job ${job.uuid} at ${job.progress_current}/${job.progress_total} after ${Math.round(progressIdleMs / 1000)}s idle (no live queue work)`,
                    );
                }

                await this.bulkJobsService.finalizeIncomplete(job);
                this.lastProgress.delete(job.uuid);
                closed += 1;
            }
            if (closed > 0) {
                this.logger.warn(`Closed ${closed} incomplete bulk job(s)`);
            }
        } finally {
            this.running = false;
        }
    }

    private queues(): Array<{ name: string; queue: Queue }> {
        return [
            { name: AI_PROCESS_QUEUE, queue: this.aiProcessQueue },
            { name: FILTER_SCRAPE_QUEUE, queue: this.filterScrapeQueue },
            { name: OUTREACH_SEND_QUEUE, queue: this.outreachSendQueue },
            { name: MARKETING_CAMPAIGN_DISPATCH_QUEUE, queue: this.campaignDispatchQueue },
            { name: MARKETING_MESSAGE_SEND_QUEUE, queue: this.campaignSendQueue },
        ];
    }

    private async collectLiveBulkUuids(): Promise<Map<string, Set<string>>> {
        const map = new Map<string, Set<string>>();
        for (const { name, queue } of this.queues()) {
            const ids = new Set<string>();
            try {
                const jobs = await this.listPendingQueueJobs(queue);
                for (const job of jobs) {
                    const uuid = bulkJobUuidFromQueueData(job.data);
                    if (uuid) ids.add(uuid);
                }
            } catch (error) {
                this.logger.error(
                    `Failed to scan queue ${name}: ${error instanceof Error ? error.message : error}`,
                );
            }
            map.set(name, ids);
        }
        return map;
    }

    private async listPendingQueueJobs(queue: Queue): Promise<Job[]> {
        const batches = await Promise.all(
            QUEUE_SCAN_STATES.map((state) =>
                queue.getJobs([state], 0, 10_000).catch(() => [] as Job[]),
            ),
        );
        const seen = new Set<string>();
        const merged: Job[] = [];
        for (const jobs of batches) {
            for (const job of jobs) {
                const id = String(job.id);
                if (seen.has(id)) continue;
                seen.add(id);
                merged.push(job);
            }
        }
        return merged;
    }

    private async isLive(
        job: {
            uuid: string;
            queue_name: string | null;
            queue_job_id: string | null;
            metadata: unknown;
        },
        liveByQueue: Map<string, Set<string>>,
    ): Promise<boolean> {
        if (job.queue_name && liveByQueue.get(job.queue_name)?.has(job.uuid)) {
            return true;
        }

        const entry = job.queue_name
            ? this.queues().find((q) => q.name === job.queue_name)
            : undefined;
        if (!entry) return false;

        if (await this.queueHasPendingBulkWork(entry.queue, job.uuid)) {
            return true;
        }

        const trackedIds = new Set<string>(queueJobIdsFromMetadata(job.metadata));
        if (job.queue_job_id) trackedIds.add(job.queue_job_id);

        for (const queueJobId of trackedIds) {
            if (await this.isQueueJobLive(entry.queue, queueJobId)) {
                return true;
            }
        }

        return false;
    }

    private async queueHasPendingBulkWork(queue: Queue, bulkJobUuid: string): Promise<boolean> {
        const jobs = await this.listPendingQueueJobs(queue);
        for (const job of jobs) {
            if (bulkJobUuidFromQueueData(job.data) === bulkJobUuid) {
                return true;
            }
        }
        return false;
    }

    private async isQueueJobLive(queue: Queue, queueJobId: string): Promise<boolean> {
        try {
            const queued = await queue.getJob(queueJobId);
            if (!queued) return false;
            const state = await queued.getState();
            return LIVE_JOB_STATES.includes(state);
        } catch {
            return false;
        }
    }
}

function stallMsFor(type: BulkJobType, progressTotal: number): number {
    switch (type) {
        case BulkJobType.OPENAI_BATCH:
            return 24 * 60 * 60 * 1000;
        case BulkJobType.FILTER_SCRAPE:
            return FILTER_SCRAPE_LOCK_DURATION_MS + 60_000;
        case BulkJobType.CONTACT_ENRICH:
        case BulkJobType.CONTACT_SCORE: {
            const perItemMs = 3 * 60 * 1000;
            const estimatedMs = Math.max(progressTotal, 1) * perItemMs;
            return Math.max(AI_PROCESS_JOB_TIMEOUT_MS + 5 * 60_000, estimatedMs + 5 * 60_000);
        }
        case BulkJobType.CONTACT_EMAIL_SCRAPE:
            return 20 * 60 * 1000;
        case BulkJobType.CAMPAIGN_DISPATCH:
        case BulkJobType.CAMPAIGN_MESSAGE_SEND:
            return 15 * 60 * 1000;
        default:
            return BULK_JOB_STALL_MS;
    }
}
