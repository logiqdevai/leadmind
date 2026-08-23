import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { AI_PROCESS_QUEUE } from '@/core/queues/queues.constants';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { ApifyModule } from '@/integrations/apify/apify.module';
import { WebsiteScraperModule } from '@/integrations/website-scraper/website-scraper.module';
import { GemiModule } from '@/integrations/gemi/gemi.module';
import { EnrichmentModule } from '@/modules/enrichment/enrichment.module';
import { BulkJobsModule } from '@/modules/bulk-jobs/bulk-jobs.module';
import { AiUsageModule } from '@/modules/ai-usage/ai-usage.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadAiService } from './utils/lead-ai.service';
import { LeadEnrichmentOrchestrator } from './services/lead-enrichment.orchestrator';
import { LeadEnrichmentSummaryService } from './services/lead-enrichment-summary.service';
import { LeadEnrichmentBatchService } from './services/lead-enrichment-batch.service';

@Module({
    imports: [
        PrismaModule,
        AiIntegrationModule,
        ApifyModule,
        WebsiteScraperModule,
        GemiModule,
        forwardRef(() => EnrichmentModule),
        BulkJobsModule,
        BullModule.registerQueue({ name: AI_PROCESS_QUEUE }),
        AiUsageModule,
    ],
    controllers: [LeadsController],
    providers: [
        LeadsService,
        LeadAiService,
        LeadEnrichmentOrchestrator,
        LeadEnrichmentSummaryService,
        LeadEnrichmentBatchService,
    ],
    exports: [
        LeadsService,
        LeadAiService,
        LeadEnrichmentOrchestrator,
        LeadEnrichmentSummaryService,
        LeadEnrichmentBatchService,
    ],
})
export class LeadsModule { }
