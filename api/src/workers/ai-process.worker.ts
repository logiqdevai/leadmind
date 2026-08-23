import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ContactAiService } from '@/modules/contacts/services/contact-ai.service';
import { BulkJobsService } from '@/modules/bulk-jobs/bulk-jobs.service';
import { LeadEnrichmentOrchestrator } from '@/modules/leads/services/lead-enrichment.orchestrator';
import { LeadEnrichmentBatchService } from '@/modules/leads/services/lead-enrichment-batch.service';
import { AI_PROCESS_QUEUE } from '@/core/queues/queues.constants';
import {
    AiProcessJobData,
    ContactJobData,
    LeadBatchEnrichPrepareJobData,
    LeadJobData,
} from './interfaces/workers.interfaces';
import {
    isContactJob,
    isLeadBatchEnrichPrepareJob,
    isLeadJob,
    resolveContactEnrichmentSources,
    resolveLeadJobEnrichmentSources,
} from './utils/workers.utils';
import { resolveLeadEnrichmentSources } from '@/modules/leads/utils/enrichment-sources.utils';

@Processor(AI_PROCESS_QUEUE, { concurrency: 5 })
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
        if (isLeadBatchEnrichPrepareJob(job.data)) {
            await this.processLeadBatchEnrichPrepare(job.data);
            return;
        }
        if (isLeadJob(job.data)) {
            await this.processLeadJob(job.data);
            return;
        }
        if (isContactJob(job.data)) {
            await this.processContactJob(job.data);
            return;
        }
        this.logger.warn(`Unknown ai-process job payload: ${JSON.stringify(job.data)}`);
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
                await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed: true });
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
            await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed });
        }
    }

    private async processContactJob(data: ContactJobData): Promise<void> {
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
            this.logger.warn(`Contact ${data.contact_uuid} not found — skipping`);
            if (data.bulk_job_uuid) {
                await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed: true });
            }
            return;
        }

        const { lead } = contact;
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

        if (full_pipeline || action === 'enrich') {
            let enrichFailed = false;
            try {
                this.logger.log(
                    `Contact ${contact.uuid} enrichment starting (sources: ${sources.join(', ')})`,
                );
                await this.leadEnrichmentOrchestrator.runForContact(contact.uuid, sources, {
                    force: data.force_enrichment ?? false,
                });
                this.logger.log(`Contact ${contact.uuid} enrichment finished`);
            } catch (error) {
                enrichFailed = true;
                this.logger.error(`Contact ${contact.uuid} enrich step failed: ${this.errMsg(error)}`);
            }
            if (data.bulk_job_uuid) {
                await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed: enrichFailed });
            }
        }

        if ((full_pipeline || action === 'score') && combinedFilter) {
            let scoreFailed = false;
            try {
                const fresh_lead = await this.prisma.lead.findUnique({ where: { uuid: lead.uuid } });
                if (fresh_lead) {
                    await this.contactAiService.scoreContact(
                        contact,
                        fresh_lead,
                        combinedFilter,
                        data.scoring_instruction_uuids?.length
                            ? { onlyInstructionUuids: data.scoring_instruction_uuids }
                            : undefined,
                    );
                }
            } catch (error) {
                scoreFailed = true;
                this.logger.error(`Contact ${contact.uuid} score step failed: ${this.errMsg(error)}`);
            }
            if (!full_pipeline && action === 'score' && data.bulk_job_uuid) {
                await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed: scoreFailed });
            }
        } else if ((full_pipeline || action === 'score') && !combinedFilter) {
            this.logger.warn(`Contact ${contact.uuid} has no linked filters — skipping score`);
            if (!full_pipeline && action === 'score' && data.bulk_job_uuid) {
                await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed: true });
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
                if (!full_pipeline && action === 'draft' && data.bulk_job_uuid) {
                    await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed: true });
                }
                return;
            }
            let draftFailed = false;
            try {
                const fresh_lead = await this.prisma.lead.findUnique({ where: { uuid: lead.uuid } });
                if (fresh_lead) {
                    for (const filter of draftFilters) {
                        await this.contactAiService.draftOutreachMessages(contact, fresh_lead, filter);
                    }
                }
            } catch (error) {
                draftFailed = true;
                this.logger.error(`Contact ${contact.uuid} draft step failed: ${this.errMsg(error)}`);
            }
            if (!full_pipeline && action === 'draft' && data.bulk_job_uuid) {
                await this.bulkJobsService.recordItemOutcome(data.bulk_job_uuid, { failed: draftFailed });
            }
        }
    }

    private errMsg(error: unknown): string {
        return error instanceof Error ? error.message : 'Unknown error';
    }
}
