import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ExternalIntegrationProvider } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ScrapioCredentialsService } from '@/integrations/scrapio/services/scrapio-credentials.service';
import { ScrapioRunWaiterService } from '@/integrations/scrapio/scrapio-run-waiter.service';
import type {
  CrawlRunPage,
  ExtractionResultEntity,
  WorkflowRunStatus,
} from '@/integrations/scrapio/interfaces/scrapio-crawl-runs.interface';
import { WebsiteScrapeDispatchService } from './services/website-scrape-dispatch.service';
import {
  SCRAPIO_SIGNATURE_HEADER,
  verifyScrapioSignature,
} from './utils/verify-scrapio-signature.util';

/**
 * Shape of the JSON body Scrapio actually POSTs to the webhook URL — confirmed against live
 * deliveries. It is NOT the same shape as the delivery-log entries their dashboard/API show
 * (those wrap this object under a `payload` key alongside dashboard-only bookkeeping fields
 * like `event_type`/`is_test`, which are never sent to the webhook endpoint itself).
 */
interface ScrapioWebhookBody {
  event?: string;
  created_at?: string;
  data?: {
    workflow_run_id?: string | null;
    status?: WorkflowRunStatus;
    error_message?: string | null;
    /** Present once a PLAIN_SCRAPE run finishes. */
    result?: { pages?: CrawlRunPage[] };
    /** Present once a run with STRUCTURED_JSON/MARKDOWN output finishes. */
    extraction_result?: ExtractionResultEntity | null;
  };
}

const TERMINAL_RUN_STATUSES: readonly WorkflowRunStatus[] = [
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'CANCELLED',
];

@ApiTags('webhooks')
@Controller('webhooks/scrapio')
export class ScrapioWebhookController {
  private readonly logger = new Logger(ScrapioWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scrapioCredentials: ScrapioCredentialsService,
    private readonly runWaiter: ScrapioRunWaiterService,
    private readonly scrapeDispatch: WebsiteScrapeDispatchService,
  ) {}

  @Post(':integration_uuid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Scrapio workflow run events' })
  async handle(
    @Param('integration_uuid') integration_uuid: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers(SCRAPIO_SIGNATURE_HEADER) signature: string,
    @Body() body: ScrapioWebhookBody,
  ): Promise<{ ok: true }> {
    const integration = await this.prisma.integration.findUnique({
      where: { uuid: integration_uuid },
      select: { organisation_uuid: true, provider: true },
    });
    if (
      !integration ||
      integration.provider !== ExternalIntegrationProvider.SCRAPIO
    ) {
      throw new NotFoundException('Unknown Scrapio integration');
    }

    const secret = await this.scrapioCredentials.tryGetScrapioWebhookSecret(
      integration.organisation_uuid,
    );
    if (!secret) {
      this.logger.warn(
        `Scrapio webhook: no webhook secret configured for organisation ${integration.organisation_uuid}`,
      );
      return { ok: true };
    }

    const raw = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(body);
    if (!verifyScrapioSignature(raw, signature, secret)) {
      this.logger.warn(
        `Scrapio webhook signature mismatch org=${integration.organisation_uuid} ` +
          `hasRawBody=${Boolean(req.rawBody)} signaturePresent=${Boolean(signature)} ` +
          `signatureLength=${signature?.length ?? 0} rawBodyLength=${raw.length}`,
      );
      throw new UnauthorizedException('Invalid Scrapio webhook signature');
    }

    const data = body.data;
    this.logger.log(
      `Scrapio webhook event received org=${integration.organisation_uuid} event=${body.event ?? 'unknown'} run=${data?.workflow_run_id ?? 'n/a'} status=${data?.status ?? 'n/a'}`,
    );

    const isTerminalRunEvent = Boolean(
      data?.workflow_run_id && data.status && TERMINAL_RUN_STATUSES.includes(data.status),
    );

    if (isTerminalRunEvent) {
      // Use the run data embedded in this delivery directly — don't re-fetch via the API.
      // Scrapio purges a `persist_results: false` run's structured_data/pages almost
      // immediately after it finishes, so a separate GET here can lose that race and come
      // back empty even though the webhook body itself still has everything.
      const workflow_run_id = data!.workflow_run_id as string;
      const status = data!.status as WorkflowRunStatus;
      const pages = data!.result?.pages ?? [];
      try {
        // Two independent consumers may be waiting on this run: the blocking-wait facade
        // (prepareWebsiteBatch) via the Redis waiter, or a persisted WebsiteScrapeRequest via
        // the dispatch service. Both are no-ops if nobody's actually waiting on this run.
        await this.runWaiter.publishResult(workflow_run_id, { status, pages });
        await this.scrapeDispatch.processCompletion(workflow_run_id, {
          status,
          pages,
          structuredData: data!.extraction_result?.structured_data ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to process Scrapio run ${workflow_run_id}: ${message}`);
      }
    }

    return { ok: true };
  }
}
