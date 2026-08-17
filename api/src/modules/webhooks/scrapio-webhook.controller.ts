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

    // Event routing (e.g. syncing crawl results back into leads) isn't wired up yet —
    // this verifies and logs deliveries until that business logic is defined.

    return { ok: true };
  }
}
