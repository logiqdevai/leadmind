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
import { ScrapioCrawlRunsService } from '@/integrations/scrapio/services/scrapio-crawl-runs.service';
import { ScrapioRunWaiterService } from '@/integrations/scrapio/scrapio-run-waiter.service';
import { SCRAPIO_TERMINAL_WEBHOOK_EVENTS } from '@/integrations/scrapio/scrapio.constants';
import { WebsiteScrapeDispatchService } from './services/website-scrape-dispatch.service';
import {
  SCRAPIO_SIGNATURE_HEADER,
  verifyScrapioSignature,
} from './utils/verify-scrapio-signature.util';

interface ScrapioWebhookBody {
  event_type?: string;
  workflow_run_id?: string | null;
  is_test?: boolean;
}

@ApiTags('webhooks')
@Controller('webhooks/scrapio')
export class ScrapioWebhookController {
  private readonly logger = new Logger(ScrapioWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scrapioCredentials: ScrapioCredentialsService,
    private readonly scrapioCrawlRuns: ScrapioCrawlRunsService,
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
      throw new UnauthorizedException('Invalid Scrapio webhook signature');
    }

    this.logger.log(
      `Scrapio webhook event received org=${integration.organisation_uuid} type=${body.event_type ?? 'unknown'} run=${body.workflow_run_id ?? 'n/a'} test=${Boolean(body.is_test)}`,
    );

    const isTerminalRunEvent =
      body.workflow_run_id &&
      !body.is_test &&
      (SCRAPIO_TERMINAL_WEBHOOK_EVENTS as readonly string[]).includes(body.event_type ?? '');

    if (isTerminalRunEvent) {
      // Fetch the run (which includes `pages`) before acking — Scrapio purges the
      // `persist_results: false` payload once this handler confirms delivery.
      try {
        const run = await this.scrapioCrawlRuns.findOne(
          integration.organisation_uuid,
          body.workflow_run_id as string,
        );
        // Two independent consumers may be waiting on this run: the blocking-wait facade
        // (prepareWebsiteBatch) via the Redis waiter, or a persisted WebsiteScrapeRequest via
        // the dispatch service. Both are no-ops if nobody's actually waiting on this run.
        await this.runWaiter.publishResult(body.workflow_run_id as string, {
          status: run.status,
          pages: run.pages ?? [],
        });
        await this.scrapeDispatch.processCompletion(body.workflow_run_id as string, {
          status: run.status,
          pages: run.pages ?? [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to fetch/publish Scrapio run ${body.workflow_run_id}: ${message}`,
        );
      }
    }

    return { ok: true };
  }
}
