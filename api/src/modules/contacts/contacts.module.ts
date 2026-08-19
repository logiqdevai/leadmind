import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { ApifyModule } from '@/integrations/apify/apify.module';
import { WebsiteScraperModule } from '@/integrations/website-scraper/website-scraper.module';
import { AI_PROCESS_QUEUE } from '@/core/queues/queues.constants';
import { OutreachModule } from '@/modules/outreach/outreach.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { SenderProfilesModule } from '@/modules/sender-profiles/sender-profiles.module';
import { EnrichmentModule } from '@/modules/enrichment/enrichment.module';
import { AiUsageModule } from '@/modules/ai-usage/ai-usage.module';
import { BulkJobsModule } from '@/modules/bulk-jobs/bulk-jobs.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactAiService } from './services/contact-ai.service';

@Module({
    imports: [
        PrismaModule,
        AiIntegrationModule,
        ApifyModule,
        WebsiteScraperModule,
        OutreachModule,
        IntegrationsModule,
        SenderProfilesModule,
        EnrichmentModule,
        BullModule.registerQueue({ name: AI_PROCESS_QUEUE }),
        AiUsageModule,
        BulkJobsModule,
    ],
    controllers: [ContactsController],
    providers: [ContactsService, ContactAiService],
    exports: [ContactsService, ContactAiService],
})
export class ContactsModule { }
