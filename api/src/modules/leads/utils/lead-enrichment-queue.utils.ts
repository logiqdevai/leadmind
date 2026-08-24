import { Queue } from 'bullmq';
import { EnrichmentSource } from '@/generated/prisma';
import type {
    LeadBatchEnrichPrepareJobData,
    LeadJobData,
} from '@/workers/interfaces/workers.interfaces';

export async function enqueueLeadBatchEnrichPrepareJob(
    queue: Queue,
    organisation_uuid: string,
    lead_uuids: string[],
    enrichment_sources: EnrichmentSource[],
    bulk_job_uuid?: string,
): Promise<{ jobId: string }> {
    const payload: LeadBatchEnrichPrepareJobData = {
        job_kind: 'lead_batch_enrich_prepare',
        organisation_uuid,
        lead_uuids,
        enrichment_sources,
        ...(bulk_job_uuid ? { bulk_job_uuid } : {}),
    };
    const job = await queue.add('lead-batch-enrich-prepare', payload, {
        removeOnComplete: 100,
        removeOnFail: 100,
    });
    return { jobId: String(job.id) };
}

export async function enqueueLeadEnrichmentJob(
    queue: Queue,
    leadUuid: string,
    enrichment_sources: EnrichmentSource[],
    bulk_job_uuid?: string,
): Promise<{ jobId: string }> {
    const payload: LeadJobData = {
        lead_uuid: leadUuid,
        enrichment_sources,
        force_enrichment: true,
        ...(bulk_job_uuid ? { bulk_job_uuid } : {}),
    };
    const job = await queue.add(`lead-enrich:${leadUuid}`, payload, {
        removeOnComplete: 100,
        removeOnFail: 100,
    });
    return { jobId: String(job.id) };
}
