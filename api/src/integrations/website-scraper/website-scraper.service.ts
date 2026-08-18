import { Injectable } from '@nestjs/common';
import {
  CrawledPage,
  CrawlSinglePageOptions,
  WebsiteContentCrawlerQueryConfig,
} from '@/integrations/apify/website-content-crawler/website-content-crawler.interfaces';
import { ApifyUsageOptions } from '@/integrations/apify/interfaces/apify-usage.interface';
import { WebsiteContentCrawlerAdapter } from '@/integrations/apify/website-content-crawler/website-content-crawler.adapter';
import { ApifyCredentialsService } from '@/integrations/apify/services/apify-credentials.service';
import { ScrapioCredentialsService } from '@/integrations/scrapio/services/scrapio-credentials.service';
import { ScrapioWebsiteCrawlerAdapter } from '@/integrations/scrapio/scrapio-website-crawler.adapter';
import { WEBSITE_SCRAPER_CONFIG, WebsiteScrapingProvider } from './website-scraper.config';

export type { WebsiteScrapingProvider };

/**
 * Facade in front of website content fetching, switching between Apify (default, untouched)
 * and Scrapio's plain-scrape mode based on `WEBSITE_SCRAPER_CONFIG.provider`. Exposes the same
 * shape as `WebsiteContentCrawlerAdapter` so call sites only need to swap which adapter they
 * inject, not how they call it.
 */
@Injectable()
export class WebsiteScraperService {
  constructor(
    private readonly apifyWebsiteCrawler: WebsiteContentCrawlerAdapter,
    private readonly apifyCredentials: ApifyCredentialsService,
    private readonly scrapioWebsiteCrawler: ScrapioWebsiteCrawlerAdapter,
    private readonly scrapioCredentials: ScrapioCredentialsService,
  ) {}

  /** Which provider is currently active for website content fetching. */
  getActiveProvider(): WebsiteScrapingProvider {
    return WEBSITE_SCRAPER_CONFIG.provider;
  }

  private activeProvider(): WebsiteScrapingProvider {
    return this.getActiveProvider();
  }

  /** Whether the currently active website-scraping provider has credentials configured. */
  async isConfigured(organisation_uuid: string): Promise<boolean> {
    return this.activeProvider() === 'scrapio'
      ? this.scrapioCredentials.hasScrapioApiKey(organisation_uuid)
      : this.apifyCredentials.hasApifyApiKey(organisation_uuid);
  }

  async crawlPages(
    organisation_uuid: string,
    query_config: WebsiteContentCrawlerQueryConfig,
    usage?: ApifyUsageOptions,
  ): Promise<CrawledPage[]> {
    return this.activeProvider() === 'scrapio'
      ? this.scrapioWebsiteCrawler.crawlPages(organisation_uuid, query_config, usage)
      : this.apifyWebsiteCrawler.crawlPages(organisation_uuid, query_config, usage);
  }

  async crawlSinglePage(
    organisation_uuid: string,
    url: string,
    options: CrawlSinglePageOptions = {},
    usage?: ApifyUsageOptions,
  ): Promise<CrawledPage | null> {
    return this.activeProvider() === 'scrapio'
      ? this.scrapioWebsiteCrawler.crawlSinglePage(organisation_uuid, url, options, usage)
      : this.apifyWebsiteCrawler.crawlSinglePage(organisation_uuid, url, options, usage);
  }
}
