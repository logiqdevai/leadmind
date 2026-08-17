import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
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
];

@Module({
  imports: [PrismaModule, IntegrationsModule],
  providers: SERVICES,
  exports: SERVICES,
})
export class ScrapioModule {}
