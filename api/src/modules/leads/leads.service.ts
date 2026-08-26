import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BulkJobStatus, BulkJobType, EnrichmentSource, Prisma, Lead } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ElasticsearchService } from '@/integrations/elasticsearch/elasticsearch.service';
import { AI_PROCESS_QUEUE } from '@/core/queues/queues.constants';
import { BulkJobsService } from '@/modules/bulk-jobs/bulk-jobs.service';
import { BulkEnrichLeadsDto } from './dto/bulk-enrich-leads.dto';
import { EnrichLeadDto } from './dto/enrich-lead.dto';
import { ListLeadEnrichmentsDto } from './dto/list-lead-enrichments.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { resolveLeadEnrichmentSources } from './utils/enrichment-sources.utils';
import {
    enqueueLeadBatchEnrichPrepareJob,
    enqueueLeadEnrichmentJob,
} from './utils/lead-enrichment-queue.utils';
import { LeadEnrichmentBatchService } from './services/lead-enrichment-batch.service';
import { EnrichmentQueryService } from '@/modules/enrichment/services/enrichment-query.service';

@Injectable()
export class LeadsService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(AI_PROCESS_QUEUE) private readonly aiProcessQueue: Queue,
        private readonly elasticsearchService: ElasticsearchService,
        private readonly leadEnrichmentBatchService: LeadEnrichmentBatchService,
        private readonly enrichmentQueryService: EnrichmentQueryService,
        private readonly bulkJobsService: BulkJobsService,
    ) { }

    async findAll(query: ListLeadsDto): Promise<{
        data: Lead[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where: Prisma.LeadWhereInput = {
            ...(query.source_type && { source_type: query.source_type }),
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                    { company: { contains: query.search, mode: 'insensitive' } },
                    { description: { contains: query.search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.lead.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.lead.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(uuid: string): Promise<Lead> {
        const lead = await this.prisma.lead.findUnique({ where: { uuid } });
        if (!lead) {
            throw new NotFoundException(`Lead ${uuid} not found`);
        }
        return lead;
    }

    async update(uuid: string, dto: UpdateLeadDto): Promise<Lead> {
        await this.findOne(uuid);
        return this.prisma.lead.update({
            where: { uuid },
            data: dto,
        });
    }

    async remove(uuid: string): Promise<{ uuid: string }> {
        await this.findOne(uuid);
        const contacts = await this.prisma.contact.findMany({
            where: { lead_uuid: uuid },
            select: { uuid: true },
        });
        await this.prisma.lead.delete({ where: { uuid } });
        await this.elasticsearchService.deleteLead(uuid);
        await Promise.all(contacts.map((c) => this.elasticsearchService.deleteContact(c.uuid)));
        return { uuid };
    }

    async findEnrichmentsForLead(leadUuid: string, query: ListLeadEnrichmentsDto) {
        await this.findOne(leadUuid);
        return this.enrichmentQueryService.findForTarget('lead', leadUuid, query);
    }

    async triggerEnrich(
        organisation_uuid: string,
        uuid: string,
        dto: EnrichLeadDto,
        user_uuid?: string | null,
    ): Promise<
        | { jobId: string; is_batch: false }
        | { batch_id: string; queued: number; is_batch: true }
        | { jobId: string; queued: number; is_batch: true; gemi_only: true }
    > {
        await this.findOne(uuid);
        const enrichment_sources: EnrichmentSource[] = resolveLeadEnrichmentSources(dto.sources);

        if (dto.use_batch) {
            const result = await this.leadEnrichmentBatchService.prepareAndSubmitBulk(
                organisation_uuid,
                [uuid],
                enrichment_sources,
                user_uuid,
            );
            if (result.gemi_only) {
                return { jobId: '', queued: 0, is_batch: true, gemi_only: true };
            }
            return { batch_id: result.batch_id, queued: result.queued, is_batch: true as const };
        }

        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid,
            created_by_user_uuid: user_uuid,
            title: `Enrich lead (${uuid})`,
            type: BulkJobType.LEAD_ENRICH,
            status: BulkJobStatus.QUEUED,
            progress_total: 1,
            queue_name: AI_PROCESS_QUEUE,
            reference_type: 'lead',
            reference_uuid: uuid,
            metadata: { lead_uuids: [uuid], sources: enrichment_sources },
        });
        const job = await enqueueLeadEnrichmentJob(
            this.aiProcessQueue,
            uuid,
            enrichment_sources,
            bulkJob.uuid,
        );
        await this.bulkJobsService.markRunning(bulkJob.uuid, { queue_job_id: job.jobId });
        return { jobId: job.jobId, is_batch: false as const };
    }

    async triggerBulkEnrich(
        organisation_uuid: string,
        dto: BulkEnrichLeadsDto,
        user_uuid?: string | null,
    ): Promise<
        | { jobIds: string[]; queued: number; is_batch: false }
        | { batch_id: string; queued: number; is_batch: true }
        | { prepare_job_id: string; queued: number; is_batch: true }
        | { jobIds: string[]; queued: number; is_batch: true; gemi_only: true }
    > {
        const unique = [...new Set(dto.uuids)];
        const existing = await this.prisma.lead.findMany({
            where: { uuid: { in: unique } },
            select: { uuid: true },
        });
        if (existing.length !== unique.length) {
            const found = new Set(existing.map((e) => e.uuid));
            const missing = unique.filter((u) => !found.has(u));
            throw new NotFoundException(`Lead(s) not found: ${missing.join(', ')}`);
        }
        const enrichment_sources: EnrichmentSource[] = resolveLeadEnrichmentSources(dto.sources);

        if (dto.use_batch) {
            if (unique.length === 1) {
                const result = await this.leadEnrichmentBatchService.prepareAndSubmitBulk(
                    organisation_uuid,
                    unique,
                    enrichment_sources,
                    user_uuid,
                );
                if (result.gemi_only) {
                    return { jobIds: [], queued: 0, is_batch: true, gemi_only: true };
                }
                return { batch_id: result.batch_id, queued: result.queued, is_batch: true as const };
            }

            const bulkJob = await this.bulkJobsService.create({
                organisation_uuid,
                created_by_user_uuid: user_uuid,
                title: `Prepare lead batch enrich (${unique.length})`,
                type: BulkJobType.LEAD_ENRICH,
                status: BulkJobStatus.QUEUED,
                progress_total: unique.length,
                queue_name: AI_PROCESS_QUEUE,
                reference_type: 'leads',
                metadata: { lead_uuids: unique, sources: enrichment_sources },
            });
            const job = await enqueueLeadBatchEnrichPrepareJob(
                this.aiProcessQueue,
                organisation_uuid,
                unique,
                enrichment_sources,
                bulkJob.uuid,
            );
            await this.bulkJobsService.markRunning(bulkJob.uuid, { queue_job_id: job.jobId });
            return { prepare_job_id: job.jobId, queued: unique.length, is_batch: true as const };
        }

        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid,
            created_by_user_uuid: user_uuid,
            title: `Enrich leads (${unique.length})`,
            type: BulkJobType.LEAD_ENRICH,
            status: BulkJobStatus.QUEUED,
            progress_total: unique.length,
            queue_name: AI_PROCESS_QUEUE,
            reference_type: 'leads',
            metadata: { lead_uuids: unique, sources: enrichment_sources },
        });
        const jobs = await Promise.all(
            unique.map((leadUuid) =>
                enqueueLeadEnrichmentJob(this.aiProcessQueue, leadUuid, enrichment_sources, bulkJob.uuid),
            ),
        );
        const jobIds = jobs.map((j) => j.jobId);
        await this.bulkJobsService.markRunning(bulkJob.uuid, { queue_job_id: jobIds[0] ?? null });
        return { jobIds, queued: jobIds.length, is_batch: false as const };
    }
}
