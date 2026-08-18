import { Injectable, Logger } from '@nestjs/common';
import {
  CrawledPage,
  CrawlSinglePageOptions,
  WebsiteContentCrawlerQueryConfig,
} from '@/integrations/apify/website-content-crawler/website-content-crawler.interfaces';
import { ApifyUsageOptions } from '@/integrations/apify/interfaces/apify-usage.interface';
import { ScrapioCredentialsService } from './services/scrapio-credentials.service';
import { ScrapioPlainScrapeConfigsService } from './services/scrapio-plain-scrape-configs.service';
import { ScrapioCrawlRunsService } from './services/scrapio-crawl-runs.service';
import { ScrapioRunWaiterService } from './scrapio-run-waiter.service';
import { CrawlRunPage } from './interfaces/scrapio-crawl-runs.interface';
import { SCRAPIO_RUN_WAIT_TIMEOUT_MS } from './scrapio.constants';
import { mapCrawlRunPageToCrawledPage } from './utils/scrapio-crawl-page.utils';

/**
 * Scrapio counterpart to `WebsiteContentCrawlerAdapter` (Apify), exposing the same
 * `crawlPages`/`crawlSinglePage` shape so `WebsiteScraperService` can swap between them.
 *
 * Uses a one-off "plain scrape" config per call with `persist_results: false` ("scrape and
 * forget") and waits for the result via `ScrapioRunWaiterService`, which the Scrapio webhook
 * controller resolves once the run finishes. Only the plain list of URLs is supported — Scrapio's
 * plain-scrape mode fetches exactly the given URLs, it does not crawl/discover links, so
 * Apify-only tuning knobs on `query_config` (max_crawl_depth, html_transformer, etc.) are ignored
 * on this path.
 */
@Injectable()
export class ScrapioWebsiteCrawlerAdapter {
  private readonly logger = new Logger(ScrapioWebsiteCrawlerAdapter.name);

  constructor(
    private readonly credentials: ScrapioCredentialsService,
    private readonly plainScrapeConfigs: ScrapioPlainScrapeConfigsService,
    private readonly crawlRuns: ScrapioCrawlRunsService,
    private readonly runWaiter: ScrapioRunWaiterService,
  ) {}

  async crawlPages(
    organisation_uuid: string,
    query_config: WebsiteContentCrawlerQueryConfig,
    _usage?: ApifyUsageOptions,
  ): Promise<CrawledPage[]> {
    const urls = query_config.start_urls;
    if (!urls?.length) {
      return [];
    }

    await this.credentials.assertScrapioConfigured(organisation_uuid);

    const config = await this.plainScrapeConfigs.create(organisation_uuid, {
      name: `leadmind-website-fetch-${Date.now()}`,
      urls,
      persist_results: false,
    });

    try {
      await this.plainScrapeConfigs.runNow(organisation_uuid, config.id);
      const workflow_run_id = await this.resolveRunId(organisation_uuid, config.id);
      const envelope = await this.runWaiter.waitForResult(
        workflow_run_id,
        SCRAPIO_RUN_WAIT_TIMEOUT_MS,
      );
      return (envelope.pages as CrawlRunPage[]).map(mapCrawlRunPageToCrawledPage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Scrapio plain scrape failed for org ${organisation_uuid}: ${message}`);
      return [];
    } finally {
      await this.plainScrapeConfigs.remove(organisation_uuid, config.id).catch(() => undefined);
    }
  }

  /** Convenience: fetch a single URL. */
  async crawlSinglePage(
    organisation_uuid: string,
    url: string,
    _options: CrawlSinglePageOptions = {},
    usage?: ApifyUsageOptions,
  ): Promise<CrawledPage | null> {
    const pages = await this.crawlPages(organisation_uuid, { start_urls: [url] }, usage);
    return pages[0] ?? null;
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
