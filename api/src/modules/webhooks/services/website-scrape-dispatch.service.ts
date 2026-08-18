import { Injectable, Logger } from '@nestjs/common';
import { WebsiteScrapeOperation, WebsiteScrapeStatus } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ScrapioPlainScrapeConfigsService } from '@/integrations/scrapio/services/scrapio-plain-scrape-configs.service';
import { mapCrawlRunPageToCrawledPage } from '@/integrations/scrapio/utils/scrapio-crawl-page.utils';
import type { CrawlRunPage, WorkflowRunStatus } from '@/integrations/scrapio/interfaces/scrapio-crawl-runs.interface';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { pickBestContactEmail } from '@/modules/contacts/utils/contact-website-email.utils';
import { EnrichmentOrchestrator } from '@/modules/enrichment/services/enrichment.orchestrator';
import { EnrichmentTarget } from '@/modules/enrichment/interfaces/enrichment-target.interface';

export interface WebsiteScrapeCompletionResult {
  status: WorkflowRunStatus;
  pages: CrawlRunPage[];
  /** COMBINED-scope structured extraction result (e.g. Scrapio's regex-extracted `email` field), when requested. */
  structuredData?: Record<string, unknown> | null;
}

const SUCCESS_STATUSES: WorkflowRunStatus[] = ['SUCCESS', 'PARTIAL_SUCCESS'];

/**
 * "Complete" half of the event-driven website-scrape flow — routes a resolved
 * `WebsiteScrapeRequest` to the specific business logic that was waiting on it. Provider-agnostic:
 * today only Scrapio's webhook feeds it, but any future scraper provider's webhook/callback can
 * call `processCompletion` the same way, as long as it resolves its own `WebsiteScrapeRequest` row.
 * Called from both `ScrapioWebhookController` (normal path) and `WebsiteScrapeTimeoutWorker`
 * (fallback path), both of which race safely thanks to the atomic claim in `processCompletion`.
 */
@Injectable()
export class WebsiteScrapeDispatchService {
  private readonly logger = new Logger(WebsiteScrapeDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plainScrapeConfigs: ScrapioPlainScrapeConfigsService,
    private readonly contactsService: ContactsService,
    private readonly enrichmentOrchestrator: EnrichmentOrchestrator,
  ) {}

  async processCompletion(
    provider_run_id: string,
    result: WebsiteScrapeCompletionResult,
  ): Promise<void> {
    const succeeded = SUCCESS_STATUSES.includes(result.status);
    const claimed = await this.prisma.websiteScrapeRequest.updateMany({
      where: { provider_run_id, status: WebsiteScrapeStatus.PENDING },
      data: {
        status: succeeded ? WebsiteScrapeStatus.COMPLETED : WebsiteScrapeStatus.FAILED,
        finished_at: new Date(),
        error: succeeded ? null : `Scrape run ended with status ${result.status}`,
      },
    });
    if (claimed.count === 0) {
      return;
    }

    const request = await this.prisma.websiteScrapeRequest.findUnique({
      where: { provider_run_id },
    });
    if (!request) {
      return;
    }

    try {
      await this.dispatch(request, succeeded, result.pages, result.structuredData ?? null);
    } finally {
      await this.plainScrapeConfigs
        .remove(request.organisation_uuid, request.provider_config_id)
        .catch((error) => {
          this.logger.warn(
            `Failed to clean up provider scrape config ${request.provider_config_id}: ${error instanceof Error ? error.message : error}`,
          );
        });
    }
  }

  /** Resolves a request that timed out waiting for its provider's callback — same dispatch, synthetic failure. */
  async resolveAsTimedOut(scrapeRequestId: string): Promise<void> {
    const claimed = await this.prisma.websiteScrapeRequest.updateMany({
      where: { id: scrapeRequestId, status: WebsiteScrapeStatus.PENDING },
      data: {
        status: WebsiteScrapeStatus.FAILED,
        finished_at: new Date(),
        error: 'Timed out waiting for the scrape provider to resolve this request',
      },
    });
    if (claimed.count === 0) {
      return;
    }

    const request = await this.prisma.websiteScrapeRequest.findUnique({
      where: { id: scrapeRequestId },
    });
    if (!request) {
      return;
    }

    try {
      await this.dispatch(request, false, [], null);
    } finally {
      await this.plainScrapeConfigs
        .remove(request.organisation_uuid, request.provider_config_id)
        .catch(() => undefined);
    }
  }

  private async dispatch(
    request: { operation: WebsiteScrapeOperation; organisation_uuid: string; reference_uuid: string; context: unknown; error: string | null },
    succeeded: boolean,
    rawPages: CrawlRunPage[],
    structuredData: Record<string, unknown> | null,
  ): Promise<void> {
    const context = (request.context as Record<string, unknown> | null) ?? {};

    switch (request.operation) {
      case WebsiteScrapeOperation.CONTACT_EMAIL_SCRAPE: {
        const bulk_job_uuid = context.bulk_job_uuid as string | undefined;
        if (succeeded) {
          // Scrapio's regex-preset field returns EVERY matching email found across the combined
          // pages (e.g. { emails: ["a@x.com", "b@y.com"] }), not a single value — pick the best
          // one the same way the Apify path does.
          const rawEmails = structuredData?.emails;
          const emails = Array.isArray(rawEmails)
            ? rawEmails.filter((e): e is string => typeof e === 'string').map((e) => e.trim()).filter(Boolean)
            : [];
          const email = pickBestContactEmail(emails);
          await this.contactsService.finishContactEmailScrapeWithEmail(
            request.organisation_uuid,
            request.reference_uuid,
            email,
          );
        }
        if (bulk_job_uuid) {
          await this.contactsService.completeBulkEmailScrapeItem(bulk_job_uuid, {
            failed: !succeeded,
          });
        }
        return;
      }
      case WebsiteScrapeOperation.LEAD_WEBSITE_ENRICHMENT:
      case WebsiteScrapeOperation.CONTACT_WEBSITE_ENRICHMENT: {
        const target: EnrichmentTarget = {
          kind: request.operation === WebsiteScrapeOperation.LEAD_WEBSITE_ENRICHMENT ? 'lead' : 'contact',
          uuid: request.reference_uuid,
        };
        const url = context.url as string;
        if (succeeded) {
          const page = rawPages.map(mapCrawlRunPageToCrawledPage)[0] ?? null;
          await this.enrichmentOrchestrator.finishWebsiteEnrichment(target, request.organisation_uuid, url, {
            status: 'success',
            page,
          });
        } else {
          await this.enrichmentOrchestrator.finishWebsiteEnrichment(target, request.organisation_uuid, url, {
            status: 'failed',
            error: request.error ?? 'Website scrape run failed',
          });
        }
        return;
      }
      default: {
        const _exhaustive: never = request.operation;
        this.logger.warn(`Unhandled website scrape operation: ${_exhaustive}`);
      }
    }
  }
}
