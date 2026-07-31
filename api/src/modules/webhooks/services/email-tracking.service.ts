import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
    EmailTrackingPayload,
    isTrackableHttpUrl,
    parseEmailTrackingToken,
} from '@/shared/utils/email-tracking.util';
import { WebhookEventService } from './webhook-event.service';

@Injectable()
export class EmailTrackingService {
    private readonly logger = new Logger(EmailTrackingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly webhookEventService: WebhookEventService,
    ) {}

    parseToken(token: string, secret: string): EmailTrackingPayload | null {
        const cleaned = token.replace(/\.gif$/i, '');
        return parseEmailTrackingToken(cleaned, secret);
    }

    async recordOpen(messageUuid: string): Promise<void> {
        const message = await this.prisma.outreachMessage.findUnique({
            where: { uuid: messageUuid },
            select: { uuid: true, provider_message_id: true },
        });
        if (!message) {
            this.logger.warn(`Open tracking: message not found uuid=${messageUuid}`);
            return;
        }

        await this.webhookEventService.ingest({
            kind: 'opened',
            provider_message_id: message.provider_message_id ?? message.uuid,
            metadata: {
                outreach_message_uuid: message.uuid,
                source: 'smtp_pixel',
            },
        });
    }

    async recordClick(
        messageUuid: string,
        destinationUrl: string,
    ): Promise<string | null> {
        if (!isTrackableHttpUrl(destinationUrl)) {
            this.logger.warn(
                `Click tracking: rejected non-http url message=${messageUuid}`,
            );
            return null;
        }

        const message = await this.prisma.outreachMessage.findUnique({
            where: { uuid: messageUuid },
            select: { uuid: true, provider_message_id: true },
        });
        if (!message) {
            this.logger.warn(`Click tracking: message not found uuid=${messageUuid}`);
            return null;
        }

        await this.webhookEventService.ingest({
            kind: 'clicked',
            provider_message_id: message.provider_message_id ?? message.uuid,
            metadata: {
                outreach_message_uuid: message.uuid,
                link: destinationUrl,
                source: 'smtp_click',
            },
        });

        return destinationUrl;
    }
}
