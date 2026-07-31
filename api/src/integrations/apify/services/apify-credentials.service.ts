import { BadRequestException, Injectable } from '@nestjs/common';
import {
    ExternalIntegrationProvider,
    IntegrationKeyType,
} from '@/generated/prisma';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

const APIFY_ACCOUNT = '1';

@Injectable()
export class ApifyCredentialsService {
    constructor(
        private readonly integrationsService: IntegrationsService,
        private readonly prisma: PrismaService,
    ) {}

    async hasApifyApiKey(organisation_uuid: string): Promise<boolean> {
        const key = await this.prisma.integrationKey.findFirst({
            where: {
                key_type: IntegrationKeyType.API_KEY,
                account: APIFY_ACCOUNT,
                integration: {
                    organisation_uuid,
                    provider: ExternalIntegrationProvider.APIFY,
                },
            },
            select: { uuid: true },
        });
        return Boolean(key);
    }

    async getApifyApiToken(organisation_uuid: string): Promise<string> {
        return this.integrationsService.getDecryptedSecret(
            organisation_uuid,
            ExternalIntegrationProvider.APIFY,
            IntegrationKeyType.API_KEY,
            APIFY_ACCOUNT,
        );
    }

    async assertApifyConfigured(organisation_uuid: string): Promise<void> {
        const configured = await this.hasApifyApiKey(organisation_uuid);
        if (!configured) {
            throw new BadRequestException(
                'Apify is not configured. Add your Apify API token under Integrations.',
            );
        }
    }
}
