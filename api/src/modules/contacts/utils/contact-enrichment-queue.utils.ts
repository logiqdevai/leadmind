import { Queue } from 'bullmq';
import { EnrichmentSource } from '@/generated/prisma';
import type { ContactJobData } from '@/workers/interfaces/workers.interfaces';

export async function enqueueContactEnrichmentJob(
    queue: Queue,
    contactUuid: string,
    enrichment_sources: EnrichmentSource[],
    bulk_job_uuid?: string,
): Promise<{ jobId: string }> {
    const payload: ContactJobData = {
        contact_uuid: contactUuid,
        action: 'enrich',
        enrichment_sources,
        force_enrichment: true,
        ...(bulk_job_uuid ? { bulk_job_uuid } : {}),
    };
    const job = await queue.add(`contact-enrich:${contactUuid}`, payload, {
        removeOnComplete: 100,
        removeOnFail: 100,
    });
    return { jobId: String(job.id) };
}
