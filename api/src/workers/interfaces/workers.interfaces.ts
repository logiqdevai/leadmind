import { EnrichmentSource } from "@/generated/prisma";

export type AiProcessAction = 'enrich' | 'score' | 'draft';

export interface ContactJobData {
    contact_uuid: string;
    action?: AiProcessAction;
    enrichment_sources?: EnrichmentSource[];
    force_enrichment?: boolean;
    scoring_instruction_uuids?: string[];
    bulk_job_uuid?: string;
}

export interface ContactBatchEnrichJobData {
    job_kind: 'contact_batch_enrich';
    items: ContactJobData[];
    force_enrichment?: boolean;
    bulk_job_uuid?: string;
}

export interface ContactBatchScoreJobData {
    job_kind: 'contact_batch_score';
    items: ContactJobData[];
    bulk_job_uuid?: string;
}

export interface LeadJobData {
    lead_uuid: string;
    enrichment_sources?: EnrichmentSource[];
    force_enrichment?: boolean;
    bulk_job_uuid?: string;
}

export interface LeadBatchEnrichPrepareJobData {
    job_kind: 'lead_batch_enrich_prepare';
    organisation_uuid: string;
    lead_uuids: string[];
    enrichment_sources?: EnrichmentSource[];
    bulk_job_uuid?: string;
}

export type AiProcessJobData =
    | ContactJobData
    | ContactBatchEnrichJobData
    | ContactBatchScoreJobData
    | LeadJobData
    | LeadBatchEnrichPrepareJobData;