import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { ResendModule } from '@/integrations/notifications/resend/resend.module';
import { ScrapioModule } from '@/integrations/scrapio/scrapio.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { MarketingCampaignsModule } from '@/modules/marketing-campaigns/marketing-campaigns.module';
import { ContactsModule } from '@/modules/contacts/contacts.module';
import { LeadsModule } from '@/modules/leads/leads.module';
import { EnrichmentModule } from '@/modules/enrichment/enrichment.module';
import { WEBSITE_SCRAPE_TIMEOUT_QUEUE } from '@/core/queues/queues.constants';
import { ResendWebhookController } from './resend-webhook.controller';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { UnsubscribeController } from './unsubscribe.controller';
import { UnsubscribeService } from './services/unsubscribe.service';
import { OpenAiWebhookController } from './openai-webhook.controller';
import { ScrapioWebhookController } from './scrapio-webhook.controller';
import { UtmAnalyticsWebhookController } from './utm-analytics-webhook.controller';
import { EmailTrackingController } from './email-tracking.controller';
import { WebhookEventService } from './services/webhook-event.service';
import { CampaignUtmAnalyticsService } from './services/campaign-utm-analytics.service';
import { EmailTrackingService } from './services/email-tracking.service';
import { WebsiteScrapeDispatchService } from './services/website-scrape-dispatch.service';
import { WebsiteScrapeTimeoutWorker } from './workers/website-scrape-timeout.worker';

import { OpenAiBatchDispatchService } from './services/openai-batch-dispatch.service';

@Module({
  imports: [
    PrismaModule,
    IntegrationsModule,
    ResendModule,
    ScrapioModule,
    AiIntegrationModule,
    MarketingCampaignsModule,
    ContactsModule,
    LeadsModule,
    EnrichmentModule,
    BullModule.registerQueue({ name: WEBSITE_SCRAPE_TIMEOUT_QUEUE }),
  ],
  controllers: [
    ResendWebhookController,
    TwilioWebhookController,
    UnsubscribeController,
    OpenAiWebhookController,
    ScrapioWebhookController,
    UtmAnalyticsWebhookController,
    EmailTrackingController,
  ],
  providers: [
    UnsubscribeService,
    WebhookEventService,
    CampaignUtmAnalyticsService,
    OpenAiBatchDispatchService,
    EmailTrackingService,
    WebsiteScrapeDispatchService,
    WebsiteScrapeTimeoutWorker,
  ],
  exports: [
    WebhookEventService,
    CampaignUtmAnalyticsService,
    OpenAiBatchDispatchService,
  ],
})
export class WebhooksModule {}
