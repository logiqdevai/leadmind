import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { WEBSITE_SCRAPE_TIMEOUT_QUEUE } from '@/core/queues/queues.constants';
import { ScrapioClient } from './scrapio.client';
import { ScrapioCredentialsService } from './services/scrapio-credentials.service';
import { ScrapioMetaService } from './services/scrapio-meta.service';
import { ScrapioCostsService } from './services/scrapio-costs.service';
import { ScrapioWebsiteTargetsService } from './services/scrapio-website-targets.service';
import { ScrapioScrapersService } from './services/scrapio-scrapers.service';
import { ScrapioCrawlRunsService } from './services/scrapio-crawl-runs.service';
import { ScrapioGenerationRunsService } from './services/scrapio-generation-runs.service';
import { ScrapioPlainScrapeConfigsService } from './services/scrapio-plain-scrape-configs.service';
import { ScrapioBrowserAgentConfigsService } from './services/scrapio-browser-agent-configs.service';
import { ScrapioJobsService } from './services/scrapio-jobs.service';
import { ScrapioUserIntegrationsService } from './services/scrapio-user-integrations.service';
import { ScrapioWebhooksService } from './services/scrapio-webhooks.service';
import { ScrapioRunWaiterService } from './scrapio-run-waiter.service';
import { ScrapioWebsiteCrawlerAdapter } from './scrapio-website-crawler.adapter';
import { ScrapioScrapeRequestService } from './services/scrapio-scrape-request.service';

const SERVICES = [
  ScrapioClient,
  ScrapioCredentialsService,
  ScrapioMetaService,
  ScrapioCostsService,
  ScrapioWebsiteTargetsService,
  ScrapioScrapersService,
  ScrapioCrawlRunsService,
  ScrapioGenerationRunsService,
  ScrapioPlainScrapeConfigsService,
  ScrapioBrowserAgentConfigsService,
  ScrapioJobsService,
  ScrapioUserIntegrationsService,
  ScrapioWebhooksService,
  ScrapioRunWaiterService,
  ScrapioWebsiteCrawlerAdapter,
  ScrapioScrapeRequestService,
];

@Module({
  imports: [
    PrismaModule,
    IntegrationsModule,
    BullModule.registerQueue({ name: WEBSITE_SCRAPE_TIMEOUT_QUEUE }),
  ],
  providers: SERVICES,
  exports: SERVICES,
})
export class ScrapioModule {}
