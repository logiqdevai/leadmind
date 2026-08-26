import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ContactAiService } from '@/modules/contacts/services/contact-ai.service';
import { BulkJobsService } from '@/modules/bulk-jobs/bulk-jobs.service';
import { LeadEnrichmentOrchestrator } from '@/modules/leads/services/lead-enrichment.orchestrator';
import { LeadEnrichmentBatchService } from '@/modules/leads/services/lead-enrichment-batch.service';
import {
    AI_PROCESS_CONCURRENCY,
    AI_PROCESS_JOB_TIMEOUT_MS,
    AI_PROCESS_QUEUE,
    AI_PROCESS_WORKER_CONCURRENCY,
} from '@/core/queues/queues.constants';
import {
    AiProcessJobData,
    ContactBatchEnrichJobData,
    ContactBatchScoreJobData,
    ContactJobData,
    LeadBatchEnrichPrepareJobData,
    LeadJobData,
} from './interfaces/workers.interfaces';
import {
    isContactBatchEnrichJob,
    isContactBatchScoreJob,
    isContactJob,
    isLeadBatchEnrichPrepareJob,
    isLeadJob,
    resolveContactEnrichmentSources,
    resolveLeadJobEnrichmentSources,
    mapWithConcurrency,
} from './utils/workers.utils';
import { contactUuidsFromBatchQueueData } from '@/modules/bulk-jobs/utils/bulk-job-queue.utils';
import { resolveLeadEnrichmentSources } from '@/modules/leads/utils/enrichment-sources.utils';

@Processor(AI_PROCESS_QUEUE, {
    concurrency: AI_PROCESS_WORKER_CONCURRENCY,
    lockDuration: AI_PROCESS_JOB_TIMEOUT_MS,
    lockRenewTime: Math.floor(AI_PROCESS_JOB_TIMEOUT_MS / 2),
})
export class AiProcessWorker extends WorkerHost {
    private readonly logger = new Logger(AiProcessWorker.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly contactAiService: ContactAiService,
        private readonly bulkJobsService: BulkJobsService,
        private readonly leadEnrichmentOrchestrator: LeadEnrichmentOrchestrator,
        private readonly leadEnrichmentBatchService: LeadEnrichmentBatchService,
    ) {
        super();
    }

    async process(job: Job<AiProcessJobData>): Promise<void> {
        console.log('[bulk-enrich-debug] AiProcessWorker.process', {
            id: job.id,
            name: job.name,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            dataKeys: job.data ? Object.keys(job.data) : [],
            bulk_job_uuid: 'bulk_job_uuid' in job.data ? job.data.bulk_job_uuid : undefined,
            contact_uuid: 'contact_uuid' in job.data ? job.data.contact_uuid : undefined,
            action: 'action' in job.data ? job.data.action : undefined,
        });
        if (isLeadBatchEnrichPrepareJob(job.data)) {
            await this.processLeadBatchEnrichPrepare(job.data);
            return;
        }
        if (isContactBatchEnrichJob(job.data)) {
            await this.processContactBatchEnrich(job.data);
            return;
        }
        if (isContactBatchScoreJob(job.data)) {
            await this.processContactBatchScore(job.data);
            return;
        }
        if (isLeadJob(job.data)) {
            await this.processLeadJob(job.data);
            return;
        }
        if (isContactJob(job.data)) {
            const attempts = job.opts.attempts ?? 1;
            const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= attempts;
            console.log('[bulk-enrich-debug] routing to processContactJob', {
                jobId: job.id,
                contact_uuid: job.data.contact_uuid,
                isFinalAttempt,
                attempts,
                attemptsMade: job.attemptsMade,
                enrichment_sources: job.data.enrichment_sources,
                force_enrichment: job.data.force_enrichment,
                bulk_job_uuid: job.data.bulk_job_uuid,
            });
            await this.processContactJob(job.data, isFinalAttempt);
            console.log('[bulk-enrich-debug] processContactJob returned', {
                jobId: job.id,
                contact_uuid: job.data.contact_uuid,
            });
            return;
        }
        this.logger.warn(`Unknown ai-process job payload: ${JSON.stringify(job.data)}`);
        await this.failBulkFromPayload(job.data, 'Unknown ai-process job payload');
    }

    @OnWorkerEvent('active')
    onActive(job: Job<AiProcessJobData>): void {
        console.log('[bulk-enrich-debug] worker event:active', {
            id: job.id,
            name: job.name,
            bulk_job_uuid: 'bulk_job_uuid' in job.data ? job.data.bulk_job_uuid : undefined,
            contact_uuid: 'contact_uuid' in job.data ? job.data.contact_uuid : undefined,
        });
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job<AiProcessJobData>): void {
        console.log('[bulk-enrich-debug] worker event:completed', {
            id: job.id,
            name: job.name,
            bulk_job_uuid: 'bulk_job_uuid' in job.data ? job.data.bulk_job_uuid : undefined,
            contact_uuid: 'contact_uuid' in job.data ? job.data.contact_uuid : undefined,
        });
    }

    @OnWorkerEvent('failed')
    async onFailed(job: Job<AiProcessJobData> | undefined, error: Error): Promise<void> {
        console.log('[bulk-enrich-debug] worker event:failed', {
            id: job?.id,
            name: job?.name,
            attemptsMade: job?.attemptsMade,
            attempts: job?.opts.attempts,
            error: error.message,
            bulk_job_uuid:
                job && 'bulk_job_uuid' in job.data ? job.data.bulk_job_uuid : undefined,
            contact_uuid:
                job && 'contact_uuid' in job.data ? job.data.contact_uuid : undefined,
        });
        if (!job) return;
        const attempts = job.opts.attempts ?? 1;
        if ((job.attemptsMade ?? 1) < attempts) return;
        if (isContactBatchEnrichJob(job.data) || isContactBatchScoreJob(job.data)) {
            const bulkJobUuid = job.data.bulk_job_uuid;
            const count = contactUuidsFromBatchQueueData(job.data).length;
            this.logger.error(
                `Batch job failed for bulk ${bulkJobUuid ?? 'unknown'} (${count} contacts): ${error.message}`,
            );
            return;
        }
        await this.failBulkFromPayload(job.data, error.message);
    }

    private async processLeadBatchEnrichPrepare(data: LeadBatchEnrichPrepareJobData): Promise<void> {
        const sources = resolveLeadEnrichmentSources(data.enrichment_sources);
        try {
            await this.leadEnrichmentBatchService.prepareAndSubmitBulk(
                data.organisation_uuid,
                data.lead_uuids,
                sources,
            );
            if (data.bulk_job_uuid) {
                await this.bulkJobsService.complete(data.bulk_job_uuid);
            }
        } catch (error) {
            this.logger.error(
                `Lead batch enrich prepare failed: ${this.errMsg(error)}`,
            );
            if (data.bulk_job_uuid) {
                await this.bulkJobsService.fail(data.bulk_job_uuid, this.errMsg(error));
            }
        }
    }

    private async processLeadJob(data: LeadJobData): Promise<void> {
        const lead = await this.prisma.lead.findUnique({ where: { uuid: data.lead_uuid } });
        if (!lead) {
            this.logger.warn(`Lead ${data.lead_uuid} not found — skipping enrichment`);
            if (data.bulk_job_uuid) {
                await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, {
                    failed: true,
                    item_uuid: data.lead_uuid,
                });
            }
            return;
        }
        const sources = resolveLeadJobEnrichmentSources(data);
        let failed = false;
        try {
            await this.leadEnrichmentOrchestrator.run(data.lead_uuid, sources, {
                force: data.force_enrichment ?? false,
            });
        } catch (error) {
            failed = true;
            this.logger.error(`Lead ${lead.uuid} enrichment failed: ${this.errMsg(error)}`);
        }
        if (data.bulk_job_uuid) {
            await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, {
                failed,
                item_uuid: data.lead_uuid,
            });
        }
    }

    private async processContactBatchScore(data: ContactBatchScoreJobData): Promise<void> {
        await mapWithConcurrency(data.items, AI_PROCESS_CONCURRENCY, async (item) => {
            try {
                await this.processContactJob({
                    ...item,
                    action: 'score',
                    bulk_job_uuid: data.bulk_job_uuid ?? item.bulk_job_uuid,
                });
            } catch (error) {
                this.logger.error(
                    `Contact score batch item ${item.contact_uuid} failed: ${this.errMsg(error)}`,
                );
            }
        });
    }

    private async processContactBatchEnrich(data: ContactBatchEnrichJobData): Promise<void> {
        await mapWithConcurrency(data.items, AI_PROCESS_CONCURRENCY, async (item) => {
            try {
                await this.processContactJob({
                    ...item,
                    action: item.action ?? 'enrich',
                    force_enrichment: data.force_enrichment ?? item.force_enrichment,
                    bulk_job_uuid: data.bulk_job_uuid ?? item.bulk_job_uuid,
                });
            } catch (error) {
                this.logger.error(
                    `Contact batch item ${item.contact_uuid} failed: ${this.errMsg(error)}`,
                );
            }
        });
    }

    private async processContactJob(data: ContactJobData, isFinalAttempt = true): Promise<void> {
        const t0 = Date.now();
        console.log('[bulk-enrich-debug] processContactJob enter', {
            contact_uuid: data.contact_uuid,
            action: data.action,
            bulk_job_uuid: data.bulk_job_uuid,
            isFinalAttempt,
            enrichment_sources: data.enrichment_sources,
            force_enrichment: data.force_enrichment,
        });
        let recorded = false;
        const record = async (failed: boolean) => {
            if (!data.bulk_job_uuid || recorded) {
                console.log('[bulk-enrich-debug] record skip', {
                    contact_uuid: data.contact_uuid,
                    bulk_job_uuid: data.bulk_job_uuid,
                    recorded,
                    failed,
                });
                return;
            }
            recorded = true;
            console.log('[bulk-enrich-debug] recordItemOutcome call', {
                bulk_job_uuid: data.bulk_job_uuid,
                contact_uuid: data.contact_uuid,
                failed,
                elapsedMs: Date.now() - t0,
            });
            await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, {
                failed,
                item_uuid: data.contact_uuid,
            });
            console.log('[bulk-enrich-debug] recordItemOutcome done', {
                bulk_job_uuid: data.bulk_job_uuid,
                contact_uuid: data.contact_uuid,
                failed,
            });
        };

        try {
        const contact = await this.prisma.contact.findUnique({
            where: { uuid: data.contact_uuid },
            include: {
                lead: true,
                filter: {
                    include: {
                        filter_scoring_instructions: { include: { scoring_instruction: true } },
                    },
                },
                contact_filters: {
                    include: {
                        filter: {
                            include: {
                                filter_scoring_instructions: {
                                    include: { scoring_instruction: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!contact) {
            console.log('[bulk-enrich-debug] contact not found', {
                contact_uuid: data.contact_uuid,
            });
            this.logger.warn(`Contact ${data.contact_uuid} not found — skipping`);
            await record(true);
            return;
        }

        const lead = contact.lead;
        const linkedFilters = contact.contact_filters.map((row) => row.filter);
        const combinedFilter =
            linkedFilters.length > 0
                ? {
                      ...linkedFilters[0],
                      enrichment_sources: [
                          ...new Set(linkedFilters.flatMap((f) => f.enrichment_sources)),
                      ],
                      filter_scoring_instructions: [
                          ...new Map(
                              linkedFilters
                                  .flatMap((f) => f.filter_scoring_instructions)
                                  .map((link) => [link.scoring_instruction.uuid, link]),
                          ).values(),
                      ],
                  }
                : contact.filter;
        const action = data.action;
        const full_pipeline = action === undefined;
        const sources = resolveContactEnrichmentSources(
            data,
            combinedFilter,
            linkedFilters.slice(1),
        );
        console.log('[bulk-enrich-debug] contact resolved', {
            contact_uuid: contact.uuid,
            hasLead: Boolean(lead),
            lead_uuid: lead?.uuid,
            linkedFilterCount: linkedFilters.length,
            action,
            full_pipeline,
            sources,
        });

        if (full_pipeline || action === 'enrich') {
            let enrichFailed = false;
            try {
                this.logger.log(
                    `Contact ${contact.uuid} enrichment starting (sources: ${sources.join(', ')})`,
                );
                console.log('[bulk-enrich-debug] runForContact start', {
                    contact_uuid: contact.uuid,
                    sources,
                    force: data.force_enrichment ?? false,
                });
                await this.leadEnrichmentOrchestrator.runForContact(contact.uuid, sources, {
                    force: data.force_enrichment ?? false,
                });
                console.log('[bulk-enrich-debug] runForContact finished', {
                    contact_uuid: contact.uuid,
                    elapsedMs: Date.now() - t0,
                });
                this.logger.log(`Contact ${contact.uuid} enrichment finished`);
            } catch (error) {
                enrichFailed = true;
                console.log('[bulk-enrich-debug] runForContact error', {
                    contact_uuid: contact.uuid,
                    error: this.errMsg(error),
                    isFinalAttempt,
                    elapsedMs: Date.now() - t0,
                });
                this.logger.error(`Contact ${contact.uuid} enrich step failed: ${this.errMsg(error)}`);
                if (!isFinalAttempt && action === 'enrich') {
                    throw error instanceof Error ? error : new Error(this.errMsg(error));
                }
            }
            if (full_pipeline || action === 'enrich') {
                await record(enrichFailed);
            }
        }

        const explicitScoreUuids = data.scoring_instruction_uuids?.length
            ? data.scoring_instruction_uuids
            : undefined;
        if (
            (full_pipeline || action === 'score') &&
            (combinedFilter || explicitScoreUuids)
        ) {
            let scoreFailed = false;
            try {
                if (!lead) {
                    throw new Error(`Contact ${contact.uuid} has no lead`);
                }
                const fresh_lead = await this.prisma.lead.findUnique({ where: { uuid: lead.uuid } });
                if (!fresh_lead) {
                    throw new Error(`Lead ${lead.uuid} not found`);
                }
                const scoreResult = await this.contactAiService.scoreContact(
                    contact,
                    fresh_lead,
                    combinedFilter ?? null,
                    explicitScoreUuids
                        ? { onlyInstructionUuids: explicitScoreUuids }
                        : undefined,
                );
                if (explicitScoreUuids && scoreResult.scored < explicitScoreUuids.length) {
                    throw new Error(
                        `Scored ${scoreResult.scored}/${explicitScoreUuids.length} requested instructions`,
                    );
                }
            } catch (error) {
                scoreFailed = true;
                this.logger.error(`Contact ${contact.uuid} score step failed: ${this.errMsg(error)}`);
                if (!isFinalAttempt && !full_pipeline && action === 'score') {
                    throw error instanceof Error ? error : new Error(this.errMsg(error));
                }
            }
            if (!full_pipeline && action === 'score') {
                await record(scoreFailed);
            }
        } else if ((full_pipeline || action === 'score') && !combinedFilter) {
            this.logger.warn(`Contact ${contact.uuid} has no linked filters — skipping score`);
            if (!full_pipeline && action === 'score') {
                await record(true);
            }
        }

        if (full_pipeline || action === 'draft') {
            const draftFilters =
                linkedFilters.length > 0
                    ? linkedFilters
                    : contact.filter
                      ? [contact.filter]
                      : [];
            if (draftFilters.length === 0) {
                this.logger.warn(`Contact ${contact.uuid} has no linked filters — skipping draft`);
                if (!full_pipeline && action === 'draft') {
                    await record(true);
                }
                return;
            }
            let draftFailed = false;
            try {
                const fresh_lead = lead
                    ? await this.prisma.lead.findUnique({ where: { uuid: lead.uuid } })
                    : null;
                if (fresh_lead) {
                    for (const filter of draftFilters) {
                        await this.contactAiService.draftOutreachMessages(contact, fresh_lead, filter);
                    }
                }
            } catch (error) {
                draftFailed = true;
                this.logger.error(`Contact ${contact.uuid} draft step failed: ${this.errMsg(error)}`);
            }
            if (!full_pipeline && action === 'draft') {
                await record(draftFailed);
            }
        }
        } catch (error) {
            console.log('[bulk-enrich-debug] processContactJob catch', {
                contact_uuid: data.contact_uuid,
                error: this.errMsg(error),
                isFinalAttempt,
                recorded,
            });
            if (!isFinalAttempt) {
                throw error;
            }
            this.logger.error(`Contact job ${data.contact_uuid} crashed: ${this.errMsg(error)}`);
            await record(true);
            throw error;
        } finally {
            console.log('[bulk-enrich-debug] processContactJob finally', {
                contact_uuid: data.contact_uuid,
                recorded,
                isFinalAttempt,
                hasBulk: Boolean(data.bulk_job_uuid),
            });
            if (data.bulk_job_uuid && !recorded && isFinalAttempt) {
                await record(true);
            }
        }
    }

    private async failBulkFromPayload(data: AiProcessJobData, error: string): Promise<void> {
        const bulkJobUuid = 'bulk_job_uuid' in data ? data.bulk_job_uuid : undefined;
        if (!bulkJobUuid) return;
        try {
            await this.bulkJobsService.recordItemOutcome(bulkJobUuid, {
                failed: true,
                item_uuid:
                    'contact_uuid' in data && typeof data.contact_uuid === 'string'
                        ? data.contact_uuid
                        : 'lead_uuid' in data && typeof data.lead_uuid === 'string'
                          ? data.lead_uuid
                          : undefined,
            });
        } catch (recordError) {
            this.logger.error(
                `Failed to record bulk job ${bulkJobUuid} after: ${error}; ${this.errMsg(recordError)}`,
            );
        }
    }

    private errMsg(error: unknown): string {
        return error instanceof Error ? error.message : 'Unknown error';
    }
}
