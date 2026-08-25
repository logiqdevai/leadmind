import { BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import type { ContactJobData } from '@/workers/interfaces/workers.interfaces';

export type ContactScoreEnqueueItem = {
    contactUuid: string;
    allowed: string[];
    scoringInstructionUuidsRequested?: string[];
};

const JOB_OPTS = {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
};

async function buildScoreJobPayload(
    item: ContactScoreEnqueueItem,
    bulk_job_uuid?: string,
): Promise<ContactJobData> {
    const requestedRaw = item.scoringInstructionUuidsRequested?.filter(Boolean) ?? [];
    const requested =
        requestedRaw.length > 0 ? [...new Set(requestedRaw)] : [...new Set(item.allowed)];
    if (requested.length === 0) {
        throw new BadRequestException('This filter has no scoring instructions to rescore.');
    }
    return {
        contact_uuid: item.contactUuid,
        action: 'score',
        scoring_instruction_uuids: requested,
        ...(bulk_job_uuid ? { bulk_job_uuid } : {}),
    };
}

export async function enqueueContactScoreJobs(
    queue: Queue,
    _prisma: PrismaService,
    items: ContactScoreEnqueueItem[],
    bulk_job_uuid?: string,
): Promise<{ jobIds: string[] }> {
    if (items.length === 0) {
        return { jobIds: [] };
    }
    const payloads = await Promise.all(
        items.map((item) => buildScoreJobPayload(item, bulk_job_uuid)),
    );
    const jobs = await queue.addBulk(
        payloads.map((payload) => ({
            name: 'contact-score',
            data: payload,
            opts: JOB_OPTS,
        })),
    );
    return { jobIds: jobs.map((job) => String(job.id)) };
}

export async function enqueueContactScoreJob(
    queue: Queue,
    prisma: PrismaService,
    contactUuid: string,
    allowed: string[],
    scoringInstructionUuidsRequested?: string[],
    bulk_job_uuid?: string,
): Promise<{ jobId: string }> {
    const { jobIds } = await enqueueContactScoreJobs(
        queue,
        prisma,
        [{ contactUuid, allowed, scoringInstructionUuidsRequested }],
        bulk_job_uuid,
    );
    return { jobId: jobIds[0] };
}
