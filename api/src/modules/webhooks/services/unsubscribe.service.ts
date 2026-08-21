import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CampaignContactStatus, InteractionType } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

export interface UnsubscribeResult {
    email: string | null;
    already: boolean;
}

@Injectable()
export class UnsubscribeService {
    private readonly logger = new Logger(UnsubscribeService.name);

    constructor(private readonly prisma: PrismaService) {}

    async unsubscribeByToken(token: string): Promise<UnsubscribeResult> {
        const trimmed = token?.trim();
        if (!trimmed) {
            throw new NotFoundException('Unsubscribe token not found');
        }

        const contact = await this.prisma.contact.findUnique({
            where: { unsubscribe_token: trimmed },
            select: {
                uuid: true,
                email: true,
                organisation_uuid: true,
                unsubscribed_at: true,
            },
        });
        if (!contact) {
            throw new NotFoundException('Unsubscribe token not found');
        }

        if (contact.unsubscribed_at) {
            return { email: contact.email, already: true };
        }

        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.contact.update({
                where: { uuid: contact.uuid },
                data: { unsubscribed_at: now },
            }),
            this.prisma.interaction.create({
                data: {
                    contact_uuid: contact.uuid,
                    organisation_uuid: contact.organisation_uuid,
                    type: InteractionType.UNSUBSCRIBED,
                    content: 'Contact clicked the unsubscribe link',
                },
            }),
            this.prisma.marketingCampaignContact.updateMany({
                where: {
                    contact_uuid: contact.uuid,
                    status: {
                        in: [CampaignContactStatus.PENDING, CampaignContactStatus.QUEUED],
                    },
                },
                data: { status: CampaignContactStatus.UNSUBSCRIBED },
            }),
        ]);
        this.logger.log(`Contact ${contact.uuid} unsubscribed via token`);
        return { email: contact.email, already: false };
    }
}
