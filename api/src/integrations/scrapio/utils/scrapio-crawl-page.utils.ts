import type { CrawledPage } from '@/integrations/apify/website-content-crawler/website-content-crawler.interfaces';
import type { CrawlRunPage } from '../interfaces/scrapio-crawl-runs.interface';

export function mapCrawlRunPageToCrawledPage(page: CrawlRunPage): CrawledPage {
  return {
    url: page.final_url ?? page.requested_url,
    title: page.title ?? undefined,
    text: page.cleaned_content ?? undefined,
    markdown: page.cleaned_content ?? undefined,
    html: page.raw_html ?? undefined,
    metadata: page.http_status !== null ? { http_status: page.http_status } : undefined,
  };
}
