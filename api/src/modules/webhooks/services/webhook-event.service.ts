import { Injectable, Logger } from '@nestjs/common';
import {
    CampaignContactStatus,
    Channel,
    InteractionType,
    LeadStatus,
    MsgDirection,
    MsgStatus,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ResendAdapter } from '@/integrations/notifications/resend/resend/resend.adapter';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { CampaignMessageSendService } from '@/modules/marketing-campaigns/services/campaign-message-send.service';
import { sanitizeEmailHtml } from '@/shared/utils/sanitize-html.util';

export interface ReceivedEmailContent {
    subject?: string | null;
    text?: string | null;
    html?: string | null;
}

export type WebhookEvent =
    | { kind: 'delivered'; channel: 'email' | 'sms'; provider_message_id: string; metadata?: any }
    | { kind: 'opened'; provider_message_id: string; metadata?: any }
    | { kind: 'clicked'; provider_message_id: string; metadata?: any }
    | {
          kind: 'replied';
          provider_message_id: string;
          metadata?: any;
          reply?: ReceivedEmailContent;
      }
    | { kind: 'bounced'; provider_message_id: string; metadata?: any }
    | { kind: 'failed'; channel: 'email' | 'sms'; provider_message_id: string; metadata?: any }
    | { kind: 'complained'; provider_message_id: string; metadata?: any };

const RESEND_EMAIL_ID_PATTERN =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const STATUS_RANK: Record<MsgStatus, number> = {
    [MsgStatus.PENDING]: 0,
    [MsgStatus.QUEUED]: 1,
    [MsgStatus.SENT]: 2,
    [MsgStatus.FAILED]: 3,
    [MsgStatus.BOUNCED]: 3,
    [MsgStatus.UNSUBSCRIBED]: 3,
    [MsgStatus.SKIPPED]: 3,
    [MsgStatus.DELIVERED]: 4,
    [MsgStatus.OPENED]: 5,
    [MsgStatus.CLICKED]: 6,
    [MsgStatus.REPLIED]: 7,
};

@Injectable()
export class WebhookEventService {
    private readonly logger = new Logger(WebhookEventService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly resendAdapter: ResendAdapter,
        private readonly campaignSendService: CampaignMessageSendService,
        private readonly contactsService: ContactsService,
    ) { }

    async resolveOutboundMessageIdFromReceived(
        provider_received_id: string,
        from: string,
        organisation_uuid: string,
    ): Promise<{ provider_message_id: string; email: ReceivedEmailContent | null } | null> {
        const { ids: headerIds, email } = await this.fetchReceivedEmail(
            provider_received_id,
            organisation_uuid,
        );
        for (const provider_message_id of headerIds) {
            const message = await this.prisma.outreachMessage.findFirst({
                where: { provider_message_id, organisation_uuid },
                select: { provider_message_id: true },
            });
            if (message?.provider_message_id) {
                return { provider_message_id: message.provider_message_id, email };
            }
        }

        const normalizedFrom = from.trim().toLowerCase();
        const contact = await this.prisma.contact.findFirst({
            where: { email: { equals: normalizedFrom, mode: 'insensitive' }, organisation_uuid },
            select: { uuid: true },
        });
        if (!contact) {
            return null;
        }

        const message = await this.prisma.outreachMessage.findFirst({
            where: {
                contact_uuid: contact.uuid,
                organisation_uuid,
                channel: Channel.EMAIL,
                direction: MsgDirection.OUTBOUND,
                provider_message_id: { not: null },
                status: {
                    in: [
                        MsgStatus.SENT,
                        MsgStatus.DELIVERED,
                        MsgStatus.OPENED,
                        MsgStatus.CLICKED,
                        MsgStatus.REPLIED,
                    ],
                },
            },
            orderBy: { sent_at: 'desc' },
            select: { provider_message_id: true },
        });

        return message?.provider_message_id
            ? { provider_message_id: message.provider_message_id, email }
            : null;
    }

    async ingest(event: WebhookEvent): Promise<void> {
        const outreach_message_uuid = event.metadata?.outreach_message_uuid as string | undefined;
        this.logger.log(
            `[ingest] kind=${event.kind} provider_message_id=${event.provider_message_id} outreach_message_uuid=${outreach_message_uuid ?? 'none'}`,
        );

        let message = await this.prisma.outreachMessage.findFirst({
            where: { provider_message_id: event.provider_message_id },
        });

        if (!message && outreach_message_uuid) {
            this.logger.warn(
                `[ingest] provider_message_id lookup missed — falling back to outreach_message_uuid=${outreach_message_uuid}`,
            );
            message = await this.prisma.outreachMessage.findUnique({
                where: { uuid: outreach_message_uuid },
            });
        }

        if (!message) {
            this.logger.warn(
                `[ingest] No OutreachMessage found for kind=${event.kind} provider_message_id=${event.provider_message_id}`,
            );
            return;
        }

        this.logger.log(
            `[ingest] Matched message uuid=${message.uuid} status=${message.status} campaign_uuid=${message.campaign_uuid ?? 'none'}`,
        );

        const now = new Date();
        const updates: Prisma.OutreachMessageUpdateInput = {};
        let interactionType: InteractionType | null = null;
        let interactionContent: string | null = null;
        let interactionMetadata: Record<string, unknown> | null = null;
        let mccStatus: CampaignContactStatus | null = null;
        let counterField:
            | 'delivered_count'
            | 'opened_count'
            | 'clicked_count'
            | 'bounced_count'
            | 'replied_count'
            | 'unsubscribed_count'
            | 'failed_count'
            | null = null;

        switch (event.kind) {
            case 'delivered':
                updates.delivered_at = now;
                if (this.canProgress(message.status, MsgStatus.DELIVERED)) {
                    updates.status = MsgStatus.DELIVERED;
                }
                interactionType =
                    event.channel === 'email'
                        ? InteractionType.EMAIL_DELIVERED
                        : InteractionType.SMS_DELIVERED;
                mccStatus = CampaignContactStatus.DELIVERED;
                counterField = 'delivered_count';
                break;
            case 'opened':
                updates.opened_at = now;
                if (this.canProgress(message.status, MsgStatus.OPENED)) {
                    updates.status = MsgStatus.OPENED;
                }
                interactionType = InteractionType.EMAIL_OPENED;
                mccStatus = CampaignContactStatus.OPENED;
                counterField = 'opened_count';
                break;
            case 'clicked':
                updates.clicked_at = now;
                if (this.canProgress(message.status, MsgStatus.CLICKED)) {
                    updates.status = MsgStatus.CLICKED;
                }
                interactionType = InteractionType.LINK_CLICKED;
                mccStatus = CampaignContactStatus.CLICKED;
                counterField = 'clicked_count';
                break;
            case 'replied':
                updates.replied_at = now;
                if (this.canProgress(message.status, MsgStatus.REPLIED)) {
                    updates.status = MsgStatus.REPLIED;
                }
                // Latest-reply snapshot on the message, kept for quick access by existing
                // consumers. The Interaction row created below (linked via
                // outreach_message_uuid) is the source of truth for full reply history —
                // it is never overwritten by a later reply.
                if (event.reply?.subject !== undefined) {
                    updates.reply_subject = event.reply.subject;
                }
                if (event.reply?.text !== undefined) {
                    updates.reply_text = event.reply.text;
                }
                if (event.reply?.html !== undefined) {
                    updates.reply_html = event.reply.html;
                }
                interactionType = InteractionType.REPLY_RECEIVED;
                interactionContent = event.reply?.text ?? null;
                interactionMetadata = {
                    ...(event.metadata ?? {}),
                    subject: event.reply?.subject ?? null,
                    html: event.reply?.html ?? null,
                };
                mccStatus = CampaignContactStatus.REPLIED;
                counterField = 'replied_count';
                break;
            case 'bounced':
                updates.status = MsgStatus.BOUNCED;
                updates.bounced_at = now;
                interactionType = InteractionType.EMAIL_BOUNCED;
                mccStatus = CampaignContactStatus.BOUNCED;
                counterField = 'bounced_count';
                break;
            case 'failed':
                updates.status = MsgStatus.FAILED;
                updates.failed_at = now;
                interactionType =
                    event.channel === 'email'
                        ? InteractionType.EMAIL_FAILED
                        : InteractionType.SMS_FAILED;
                mccStatus = CampaignContactStatus.FAILED;
                counterField = 'failed_count';
                break;
            case 'complained':
                updates.status = MsgStatus.UNSUBSCRIBED;
                interactionType = InteractionType.UNSUBSCRIBED;
                mccStatus = CampaignContactStatus.UNSUBSCRIBED;
                counterField = 'unsubscribed_count';
                await this.prisma.contact.update({
                    where: { uuid: message.contact_uuid },
                    data: { unsubscribed_at: now },
                });
                break;
        }

        const ops: Prisma.PrismaPromise<unknown>[] = [
            this.prisma.outreachMessage.update({
                where: { uuid: message.uuid },
                data: updates,
            }),
        ];

        if (interactionType) {
            const metadata = interactionMetadata ?? event.metadata ?? undefined;
            ops.push(
                this.prisma.interaction.create({
                    data: {
                        contact_uuid: message.contact_uuid,
                        organisation_uuid: message.organisation_uuid,
                        campaign_uuid: message.campaign_uuid,
                        outreach_message_uuid: message.uuid,
                        type: interactionType,
                        content: interactionContent ?? undefined,
                        metadata: metadata
                            ? (metadata as Prisma.InputJsonValue)
                            : undefined,
                    },
                }),
            );
        }

        if (message.campaign_uuid && mccStatus && counterField) {
            const existingMcc = await this.prisma.marketingCampaignContact.findUnique({
                where: {
                    campaign_uuid_contact_uuid_channel: {
                        campaign_uuid: message.campaign_uuid,
                        contact_uuid: message.contact_uuid,
                        channel: message.channel,
                    },
                },
            });

            if (!existingMcc) {
                this.logger.warn(
                    `[ingest] No MCC found for campaign=${message.campaign_uuid} contact=${message.contact_uuid} channel=${message.channel} — skipping counter update`,
                );
            } else if (!this.canProgressMcc(existingMcc.status, mccStatus)) {
                this.logger.log(
                    `[ingest] MCC progression blocked: ${existingMcc.status} → ${mccStatus} (kind=${event.kind}) — skipping counter`,
                );
            } else {
                this.logger.log(
                    `[ingest] MCC progressing: ${existingMcc.status} → ${mccStatus}, incrementing ${counterField}`,
                );

                const errorMessage =
                    typeof event.metadata?.reason === 'string'
                        ? event.metadata.reason
                        : typeof event.metadata?.error_message === 'string'
                          ? event.metadata.error_message
                          : undefined;

                ops.push(
                    this.prisma.marketingCampaignContact.update({
                        where: { uuid: existingMcc.uuid },
                        data: {
                            status: mccStatus,
                            ...(event.kind === 'delivered' && { delivered_at: now }),
                            ...((event.kind === 'bounced' || event.kind === 'failed') &&
                                errorMessage && { error_message: errorMessage }),
                        },
                    }),
                    this.prisma.marketingCampaign.update({
                        where: { uuid: message.campaign_uuid },
                        data: { [counterField]: { increment: 1 } },
                    }),
                );
            }
        }

        if (event.kind === 'replied') {
            ops.push(
                this.prisma.contact.update({
                    where: { uuid: message.contact_uuid },
                    data: { last_interaction_at: now },
                }),
            );
        }

        let shouldSyncContactSearchIndex = false;
        const shouldPromoteCrmStatus =
            (event.kind === 'delivered' && event.channel === 'email') ||
            (event.kind === 'replied' && message.channel === Channel.EMAIL);

        if (shouldPromoteCrmStatus) {
            const contact = await this.prisma.contact.findUnique({
                where: { uuid: message.contact_uuid },
                select: { status: true },
            });

            if (contact?.status === LeadStatus.NEW) {
                ops.push(
                    ...this.contactsService.buildPromoteToContactedIfNewOps(
                        message.contact_uuid,
                        message.organisation_uuid,
                        event.kind === 'delivered' ? 'email_delivered' : 'email_replied',
                        contact.status,
                    ),
                );
                shouldSyncContactSearchIndex = true;
            }
        }

        await this.prisma.$transaction(ops);
        this.logger.log(
            `[ingest] Transaction committed: kind=${event.kind} message=${message.uuid}`,
        );

        if (shouldSyncContactSearchIndex) {
            await this.contactsService.syncContactSearchIndex(message.contact_uuid);
        }

        if (message.campaign_uuid) {
            await this.campaignSendService.checkCompletion(message.campaign_uuid);
        }
    }

    private async fetchReceivedEmail(
        provider_received_id: string,
        organisation_uuid: string,
    ): Promise<{ ids: string[]; email: ReceivedEmailContent | null }> {
        try {
            const result = await this.resendAdapter.getReceivedEmail(provider_received_id);
            const email = result?.data;
            if (!email) {
                return { ids: [], email: null };
            }

            const content: ReceivedEmailContent = {
                subject: email.subject,
                text: email.text,
                html: email.html ? sanitizeEmailHtml(email.html) : email.html,
            };

            const headerValues: string[] = [];
            const headers = email.headers ?? {};
            for (const key of ['in-reply-to', 'references', 'message-id']) {
                const value = headers[key] ?? headers[key.toLowerCase()];
                if (typeof value === 'string') {
                    headerValues.push(value);
                }
            }

            const customMessageUuid = headers['x-message-uuid'] ?? headers['X-Message-Uuid'];
            if (typeof customMessageUuid === 'string' && customMessageUuid.trim()) {
                const byUuid = await this.prisma.outreachMessage.findFirst({
                    where: { uuid: customMessageUuid.trim(), organisation_uuid },
                    select: { provider_message_id: true },
                });
                if (byUuid?.provider_message_id) {
                    return { ids: [byUuid.provider_message_id], email: content };
                }
            }

            // Message-ID tokens are provider-agnostic: Resend generates a bare UUID,
            // while SMTP relays (nodemailer) generate an RFC-5322 `<local@domain>` id.
            // Extract both shapes so threads sent via either provider can be matched.
            const ids = new Set<string>();
            for (const value of headerValues) {
                const uuidMatches = value.match(RESEND_EMAIL_ID_PATTERN) ?? [];
                for (const match of uuidMatches) {
                    ids.add(match.toLowerCase());
                }

                const bracketedTokens = value.match(/<[^<>\s]+>/g) ?? [];
                for (const token of bracketedTokens) {
                    const bare = token.slice(1, -1).trim();
                    if (!bare) continue;
                    ids.add(bare);
                    ids.add(`<${bare}>`);
                }
            }
            return { ids: [...ids], email: content };
        } catch (error) {
            this.logger.warn(
                `Could not fetch received email ${provider_received_id}: ${error instanceof Error ? error.message : error}`,
            );
            return { ids: [], email: null };
        }
    }

    private canProgress(current: MsgStatus, next: MsgStatus): boolean {
        return STATUS_RANK[next] > STATUS_RANK[current];
    }

    private canProgressMcc(current: CampaignContactStatus, next: CampaignContactStatus): boolean {
        const order: CampaignContactStatus[] = [
            CampaignContactStatus.PENDING,
            CampaignContactStatus.QUEUED,
            CampaignContactStatus.SENT,
            CampaignContactStatus.DELIVERED,
            CampaignContactStatus.OPENED,
            CampaignContactStatus.CLICKED,
            CampaignContactStatus.REPLIED,
        ];
        if (
            current === CampaignContactStatus.FAILED ||
            current === CampaignContactStatus.SKIPPED ||
            current === CampaignContactStatus.BOUNCED ||
            current === CampaignContactStatus.UNSUBSCRIBED
        ) {
            // Terminal "negative" states don't get overwritten by positive progress
            return next === current;
        }
        const ci = order.indexOf(current);
        const ni = order.indexOf(next);
        if (ci === -1 || ni === -1) return true;
        return ni > ci;
    }
}
