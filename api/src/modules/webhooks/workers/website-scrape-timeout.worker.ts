import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WEBSITE_SCRAPE_TIMEOUT_QUEUE } from '@/core/queues/queues.constants';
import { WebsiteScrapeDispatchService } from '../services/website-scrape-dispatch.service';
import type { WebsiteScrapeTimeoutJobData } from '@/integrations/scrapio/services/scrapio-scrape-request.service';

/**
 * Fallback for a website-scrape request whose provider never called back (misconfigured
 * webhook, delivery failure, etc.). Enqueued (delayed) by `ScrapioScrapeRequestService.initiate`
 * (or any future provider's equivalent initiator); a no-op if the webhook already resolved the
 * request first (`resolveAsTimedOut` claims atomically, same as the webhook path).
 */
@Processor(WEBSITE_SCRAPE_TIMEOUT_QUEUE)
export class WebsiteScrapeTimeoutWorker extends WorkerHost {
  private readonly logger = new Logger(WebsiteScrapeTimeoutWorker.name);

  constructor(private readonly dispatch: WebsiteScrapeDispatchService) {
    super();
  }

  async process(job: Job<WebsiteScrapeTimeoutJobData>): Promise<void> {
    try {
      await this.dispatch.resolveAsTimedOut(job.data.scrapeRequestId);
    } catch (error) {
      this.logger.error(
        `Failed to resolve timed-out website scrape request ${job.data.scrapeRequestId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
