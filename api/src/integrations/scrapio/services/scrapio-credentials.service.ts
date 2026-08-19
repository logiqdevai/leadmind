import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExternalIntegrationProvider,
  IntegrationKeyType,
} from '@/generated/prisma';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

const SCRAPIO_ACCOUNT = '1';

@Injectable()
export class ScrapioCredentialsService {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly prisma: PrismaService,
  ) {}

  async hasScrapioApiKey(organisation_uuid: string): Promise<boolean> {
    const key = await this.prisma.integrationKey.findFirst({
      where: {
        key_type: IntegrationKeyType.API_KEY,
        account: SCRAPIO_ACCOUNT,
        integration: {
          organisation_uuid,
          provider: ExternalIntegrationProvider.SCRAPIO,
        },
      },
      select: { uuid: true },
    });
    return Boolean(key);
  }

  async getScrapioApiKey(organisation_uuid: string): Promise<string> {
    return this.integrationsService.getDecryptedSecret(
      organisation_uuid,
      ExternalIntegrationProvider.SCRAPIO,
      IntegrationKeyType.API_KEY,
      SCRAPIO_ACCOUNT,
    );
  }

  async getScrapioWebhookSecret(organisation_uuid: string): Promise<string> {
    return this.integrationsService.getDecryptedSecret(
      organisation_uuid,
      ExternalIntegrationProvider.SCRAPIO,
      IntegrationKeyType.WEBHOOK_SECRET,
      SCRAPIO_ACCOUNT,
    );
  }

  async tryGetScrapioWebhookSecret(
    organisation_uuid: string,
  ): Promise<string | null> {
    try {
      return await this.getScrapioWebhookSecret(organisation_uuid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  async assertScrapioConfigured(organisation_uuid: string): Promise<void> {
    const configured = await this.hasScrapioApiKey(organisation_uuid);
    if (!configured) {
      throw new BadRequestException(
        'Scrapio is not configured. Add your Scrapio API key under Integrations.',
      );
    }
  }
}
