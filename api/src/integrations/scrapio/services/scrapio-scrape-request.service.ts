import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, WebsiteScrapeOperation, WebsiteScrapeProvider } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { WEBSITE_SCRAPE_TIMEOUT_QUEUE } from '@/core/queues/queues.constants';
import { ScrapioCredentialsService } from './scrapio-credentials.service';
import { ScrapioPlainScrapeConfigsService } from './scrapio-plain-scrape-configs.service';
import { ScrapioCrawlRunsService } from './scrapio-crawl-runs.service';
import { SCRAPIO_RUN_WAIT_TIMEOUT_MS } from '../scrapio.constants';
import type {
  PlainScrapeExtractionScope,
  PlainScrapeOutputFormat,
} from '../interfaces/scrapio-plain-scrape-configs.interface';

export interface InitiateWebsiteScrapeExtraction {
  extraction_scope: PlainScrapeExtractionScope;
  output_formats: PlainScrapeOutputFormat[];
  output_schema: Record<string, unknown>;
}

export interface InitiateWebsiteScrapeInput {
  organisation_uuid: string;
  operation: WebsiteScrapeOperation;
  reference_uuid: string;
  urls: string[];
  context?: Record<string, unknown>;
  /** Ask Scrapio to run its own structured extraction (e.g. the built-in email regex preset)
   *  instead of returning raw HTML/markdown. Omit for raw content (e.g. website enrichment). */
  extraction?: InitiateWebsiteScrapeExtraction;
}

export interface InitiateWebsiteScrapeResult {
  id: string;
  provider_run_id: string;
}

export interface WebsiteScrapeTimeoutJobData {
  scrapeRequestId: string;
}

/**
 * Scrapio's concrete implementation of the "initiate" half of the event-driven website-scrape
 * flow: kicks off a one-off `persist_results: false` run and persists a generic
 * `WebsiteScrapeRequest` row (`provider: SCRAPIO`) so the webhook (or the timeout fallback) can
 * finish the specific downstream work later — see `WebsiteScrapeDispatchService`
 * (modules/webhooks) for the "complete" half. A future scraper provider would get its own
 * initiator service writing to the same table with a different `provider` value.
 */
@Injectable()
export class ScrapioScrapeRequestService {
  private readonly logger = new Logger(ScrapioScrapeRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: ScrapioCredentialsService,
    private readonly plainScrapeConfigs: ScrapioPlainScrapeConfigsService,
    private readonly crawlRuns: ScrapioCrawlRunsService,
    @InjectQueue(WEBSITE_SCRAPE_TIMEOUT_QUEUE)
    private readonly timeoutQueue: Queue<WebsiteScrapeTimeoutJobData>,
  ) {}

  async initiate(input: InitiateWebsiteScrapeInput): Promise<InitiateWebsiteScrapeResult> {
    await this.credentials.assertScrapioConfigured(input.organisation_uuid);

    const existing = await this.prisma.websiteScrapeRequest.findFirst({
      where: {
        operation: input.operation,
        reference_uuid: input.reference_uuid,
        status: 'PENDING',
      },
    });
    if (existing) {
      return { id: existing.id, provider_run_id: existing.provider_run_id };
    }

    const config = await this.plainScrapeConfigs.create(input.organisation_uuid, {
      name: `leadmind-${input.operation.toLowerCase()}-${Date.now()}`,
      urls: input.urls,
      persist_results: false,
      ...(input.extraction
        ? {
            extraction_scope: input.extraction.extraction_scope,
            output_formats: input.extraction.output_formats,
            output_schema: input.extraction.output_schema,
          }
        : {}),
    });

    await this.plainScrapeConfigs.runNow(input.organisation_uuid, config.id);
    const provider_run_id = await this.resolveRunId(input.organisation_uuid, config.id);

    const request = await this.prisma.websiteScrapeRequest.create({
      data: {
        provider: WebsiteScrapeProvider.SCRAPIO,
        provider_run_id,
        provider_config_id: config.id,
        organisation_uuid: input.organisation_uuid,
        operation: input.operation,
        reference_uuid: input.reference_uuid,
        context: (input.context as Prisma.InputJsonValue) ?? undefined,
      },
    });

    await this.timeoutQueue.add(
      `website-scrape-timeout:${request.id}`,
      { scrapeRequestId: request.id },
      { delay: SCRAPIO_RUN_WAIT_TIMEOUT_MS, removeOnComplete: true, removeOnFail: true },
    );

    return { id: request.id, provider_run_id };
  }

  private async resolveRunId(
    organisation_uuid: string,
    workflow_config_id: string,
  ): Promise<string> {
    // Assumes the list endpoint returns runs newest-first (verify against the live API);
    // safe regardless since this config is ephemeral/single-use for this one call.
    const runs = await this.crawlRuns.findAll(organisation_uuid, {
      workflow_config_id,
      limit: 1,
    });
    const run = runs.data[0];
    if (!run) {
      throw new Error(
        `No crawl run found for Scrapio plain-scrape config ${workflow_config_id}`,
      );
    }
    return run.id;
  }
}
