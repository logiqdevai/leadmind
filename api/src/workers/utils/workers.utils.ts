import { EnrichmentSource } from "@/generated/prisma";
import {
    ContactJobData,
    ContactBatchEnrichJobData,
    ContactBatchScoreJobData,
    LeadJobData,
    LeadBatchEnrichPrepareJobData,
    AiProcessJobData,
} from "../interfaces/workers.interfaces";
import {
    resolveContactEnrichmentSources as resolveContactSourceList,
    resolveLeadEnrichmentSources,
} from '@/modules/leads/utils/enrichment-sources.utils';

export const isLeadBatchEnrichPrepareJob = (
    data: AiProcessJobData,
): data is LeadBatchEnrichPrepareJobData =>
    'job_kind' in data && data.job_kind === 'lead_batch_enrich_prepare';

export const isContactBatchEnrichJob = (
    data: AiProcessJobData,
): data is ContactBatchEnrichJobData =>
    'job_kind' in data && data.job_kind === 'contact_batch_enrich';

export const isContactBatchScoreJob = (
    data: AiProcessJobData,
): data is ContactBatchScoreJobData =>
    'job_kind' in data && data.job_kind === 'contact_batch_score';

export const isContactJob = (data: AiProcessJobData): data is ContactJobData =>
    !isContactBatchEnrichJob(data) &&
    !isContactBatchScoreJob(data) &&
    'contact_uuid' in data &&
    data.contact_uuid != null;

export const isLeadJob = (data: AiProcessJobData): data is LeadJobData =>
    !isContactJob(data) &&
    !isContactBatchEnrichJob(data) &&
    !isContactBatchScoreJob(data) &&
    'lead_uuid' in data &&
    data.lead_uuid != null &&
    !isLeadBatchEnrichPrepareJob(data);

export function resolveContactEnrichmentSources(
    job: ContactJobData,
    filter: { enrichment_sources: EnrichmentSource[] } | null | undefined,
    extraFilters?: Array<{ enrichment_sources: EnrichmentSource[] }>,
): EnrichmentSource[] {
    return resolveContactSourceList(job.enrichment_sources, filter, extraFilters);
}

export function resolveLeadJobEnrichmentSources(job: LeadJobData): EnrichmentSource[] {
    return resolveLeadEnrichmentSources(job.enrichment_sources);
}

export async function mapWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    if (items.length === 0) return;
    let index = 0;
    const limit = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(
        Array.from({ length: limit }, async () => {
            while (index < items.length) {
                const current = items[index];
                index += 1;
                await fn(current);
            }
        }),
    );
}
