import { Queue } from 'bullmq';
import { EnrichmentSource } from '@/generated/prisma';
import type { ContactJobData } from '@/workers/interfaces/workers.interfaces';

export type ContactEnrichmentEnqueueItem = {
    contactUuid: string;
    enrichment_sources: EnrichmentSource[];
};

const JOB_OPTS = {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
};

export async function enqueueContactEnrichmentJobs(
    queue: Queue,
    items: ContactEnrichmentEnqueueItem[],
    bulk_job_uuid?: string,
): Promise<{ jobIds: string[] }> {
    if (items.length === 0) {
        return { jobIds: [] };
    }
    const jobs = await queue.addBulk(
        items.map((item) => {
            const payload: ContactJobData = {
                contact_uuid: item.contactUuid,
                action: 'enrich',
                enrichment_sources: item.enrichment_sources,
                force_enrichment: true,
                ...(bulk_job_uuid ? { bulk_job_uuid } : {}),
            };
            return {
                name: 'contact-enrich',
                data: payload,
                opts: JOB_OPTS,
            };
        }),
    );
    return { jobIds: jobs.map((job) => String(job.id)) };
}

export async function enqueueContactEnrichmentJob(
    queue: Queue,
    contactUuid: string,
    enrichment_sources: EnrichmentSource[],
    bulk_job_uuid?: string,
): Promise<{ jobId: string }> {
    const { jobIds } = await enqueueContactEnrichmentJobs(
        queue,
        [{ contactUuid, enrichment_sources }],
        bulk_job_uuid,
    );
    return { jobId: jobIds[0] };
}
