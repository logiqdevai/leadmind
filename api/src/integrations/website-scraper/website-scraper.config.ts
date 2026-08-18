export type WebsiteScrapingProvider = 'apify' | 'scrapio';

/**
 * Which provider fetches website content for enrichment/email-scraping. Flip this to switch
 * providers app-wide — a code change + deploy, not an env var, so it can't drift per environment.
 */
export const WEBSITE_SCRAPER_CONFIG = {
  provider: 'apify' as WebsiteScrapingProvider,
};
