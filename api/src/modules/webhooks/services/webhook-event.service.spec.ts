/// <reference types="jest" />
import {
    CampaignContactStatus,
    Channel,
    InteractionType,
    LeadStatus,
    MsgDirection,
    MsgStatus,
    ThreadReplyState,
} from '@/generated/prisma';
import { WebhookEventService } from './webhook-event.service';

describe('WebhookEventService', () => {
    const provider_message_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const organisation_uuid = 'user-uuid';
    const baseMessage = {
        uuid: 'msg-uuid',
        organisation_uuid,
        contact_uuid: 'contact-uuid',
        campaign_uuid: 'campaign-uuid',
        channel: Channel.EMAIL,
        direction: MsgDirection.OUTBOUND,
        status: MsgStatus.DELIVERED,
        provider_message_id,
    };

    function createService(overrides?: {
        message?: {
            status?: MsgStatus;
            provider_message_id?: string;
            message_id?: string | null;
            thread_uuid?: string | null;
        } | null;
        mcc?: { uuid: string; status: CampaignContactStatus } | null;
        receivedEmail?: { headers?: Record<string, string> } | null;
        contactStatus?: LeadStatus;
        contact?: { uuid: string; organisation_uuid: string } | null;
    }) {
        const message =
            overrides?.message === null ? null : { ...baseMessage, ...overrides?.message };
        const contact =
            overrides?.contact === null
                ? null
                : (overrides?.contact ?? { uuid: 'contact-uuid', organisation_uuid });

        const prisma = {
            outreachMessage: {
                // Org-aware mock: a lookup only "finds" the message when every provided
                // where-clause field (organisation_uuid included) actually matches — this is
                // what lets the cross-tenant scoping tests below be meaningful.
                findFirst: jest.fn((args: any) => {
                    if (!message) return Promise.resolve(null);
                    const where = args?.where ?? {};
                    for (const key of ['organisation_uuid', 'provider_message_id', 'uuid', 'contact_uuid']) {
                        if (typeof where[key] === 'string' && where[key] !== (message as any)[key]) {
                            return Promise.resolve(null);
                        }
                    }
                    // OR: the message must satisfy at least one alternative (each alternative is a
                    // set of field = value pairs).
                    if (Array.isArray(where.OR)) {
                        const matchesAny = where.OR.some((clause: Record<string, unknown>) =>
                            Object.entries(clause).every(
                                ([key, value]) => (message as any)[key] === value,
                            ),
                        );
                        if (!matchesAny) return Promise.resolve(null);
                    }
                    return Promise.resolve(message);
                }),
                findUnique: jest.fn((args: any) =>
                    Promise.resolve(message && args?.where?.uuid === message.uuid ? message : null),
                ),
                update: jest.fn().mockResolvedValue({}),
            },
            marketingCampaignContact: {
                findUnique: jest.fn().mockResolvedValue(overrides?.mcc ?? { uuid: 'mcc-uuid', status: CampaignContactStatus.DELIVERED }),
                update: jest.fn().mockResolvedValue({}),
            },
            marketingCampaign: {
                update: jest.fn().mockResolvedValue({}),
            },
            messageThread: {
                update: jest.fn().mockResolvedValue({}),
            },
            interaction: {
                create: jest.fn().mockResolvedValue({ uuid: 'note-uuid' }),
                update: jest.fn().mockResolvedValue({}),
            },
            contact: {
                findFirst: jest.fn((args: any) => {
                    if (!contact) return Promise.resolve(null);
                    const where = args?.where ?? {};
                    if ('organisation_uuid' in where && where.organisation_uuid !== contact.organisation_uuid) {
                        return Promise.resolve(null);
                    }
                    return Promise.resolve({ uuid: contact.uuid });
                }),
                findUnique: jest.fn().mockResolvedValue({
                    status: overrides?.contactStatus ?? LeadStatus.NEW,
                }),
                update: jest.fn().mockResolvedValue({}),
            },
            organisation: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
            sequenceEnrollment: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
            $transaction: jest.fn(async (ops: unknown[]) => {
                const results: unknown[] = [];
                for (const op of ops) {
                    results.push(await op);
                }
                return results;
            }),
        };
        const resendAdapter = {
            getReceivedEmail: jest.fn().mockResolvedValue({
                data: overrides?.receivedEmail ?? { headers: {} },
            }),
        };
        const campaignSendService = {
            checkCompletion: jest.fn().mockResolvedValue(undefined),
        };
        const contactsService = {
            buildPromoteToContactedIfNewOps: jest.fn(() => [
                prisma.contact.update({
                    where: { uuid: 'contact-uuid' },
                    data: { status: LeadStatus.CONTACTED },
                }),
                prisma.interaction.create({
                    data: {
                        contact_uuid: 'contact-uuid',
                        organisation_uuid,
                        type: InteractionType.STATUS_CHANGE,
                    },
                }),
            ]),
            buildPromoteToEngagedOnReplyOps: jest.fn(
                (_contact_uuid: string, _organisation_uuid: string, currentStatus: LeadStatus) => {
                    if (currentStatus !== LeadStatus.NEW && currentStatus !== LeadStatus.CONTACTED) {
                        return [];
                    }
                    return [
                        prisma.contact.update({
                            where: { uuid: 'contact-uuid' },
                            data: { status: LeadStatus.ENGAGED },
                        }),
                        prisma.interaction.create({
                            data: {
                                contact_uuid: 'contact-uuid',
                                organisation_uuid,
                                type: InteractionType.STATUS_CHANGE,
                            },
                        }),
                    ];
                },
            ),
            syncContactSearchIndex: jest.fn().mockResolvedValue(undefined),
        };
        const mailService = {
            create: jest.fn().mockResolvedValue(undefined),
        };
        const sequenceEnrollmentService = {
            cancelEnrollment: jest.fn().mockResolvedValue(undefined),
            cancelAllForContact: jest.fn().mockResolvedValue({ cancelled: 0 }),
        };
        const replyAnalysisQueue = {
            add: jest.fn().mockResolvedValue(undefined),
        };
        const remindersService = {
            cancelPendingFollowUp: jest.fn().mockResolvedValue(false),
        };

        return {
            service: new WebhookEventService(
                prisma as any,
                resendAdapter as any,
                campaignSendService as any,
                contactsService as any,
                mailService as any,
                sequenceEnrollmentService as any,
                remindersService as any,
                replyAnalysisQueue as any,
            ),
            prisma,
            resendAdapter,
            campaignSendService,
            contactsService,
            mailService,
            sequenceEnrollmentService,
            remindersService,
            replyAnalysisQueue,
        };
    }

    it('records email open engagement', async () => {
        const { service, prisma } = createService();

        await service.ingest({ kind: 'opened', provider_message_id });

        expect(prisma.outreachMessage.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: MsgStatus.OPENED,
                    opened_at: expect.any(Date),
                }),
            }),
        );
        expect(prisma.interaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: InteractionType.EMAIL_OPENED,
                    outreach_message_uuid: 'msg-uuid',
                }),
            }),
        );
        expect(prisma.marketingCampaign.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { opened_count: { increment: 1 } },
            }),
        );
    });

    it('promotes contact from NEW to CONTACTED on email delivery', async () => {
        const { service, contactsService } = createService({
            message: { status: MsgStatus.SENT },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.SENT },
            contactStatus: LeadStatus.NEW,
        });

        await service.ingest({
            kind: 'delivered',
            channel: 'email',
            provider_message_id,
        });

        expect(contactsService.buildPromoteToContactedIfNewOps).toHaveBeenCalledWith(
            'contact-uuid',
            organisation_uuid,
            'email_delivered',
            LeadStatus.NEW,
        );
        expect(contactsService.syncContactSearchIndex).toHaveBeenCalledWith('contact-uuid');
    });

    it('does not promote contact when status is not NEW', async () => {
        const { service, contactsService } = createService({
            message: { status: MsgStatus.SENT },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.SENT },
            contactStatus: LeadStatus.CONTACTED,
        });

        await service.ingest({
            kind: 'delivered',
            channel: 'email',
            provider_message_id,
        });

        expect(contactsService.buildPromoteToContactedIfNewOps).not.toHaveBeenCalled();
        expect(contactsService.syncContactSearchIndex).not.toHaveBeenCalled();
    });

    it('records email reply engagement, snapshotting onto the message and linking an Interaction', async () => {
        const { service, prisma, contactsService } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
            contactStatus: LeadStatus.CONTACTED,
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            metadata: { from: 'lead@example.com' },
            reply: { subject: 'Re: hello', text: 'Sounds good', html: '<p>Sounds good</p>' },
        });

        expect(prisma.outreachMessage.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: MsgStatus.REPLIED,
                    replied_at: expect.any(Date),
                    reply_subject: 'Re: hello',
                    reply_text: 'Sounds good',
                    reply_html: '<p>Sounds good</p>',
                }),
            }),
        );
        expect(prisma.interaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: InteractionType.REPLY_RECEIVED,
                    outreach_message_uuid: 'msg-uuid',
                    content: 'Sounds good',
                    metadata: expect.objectContaining({
                        subject: 'Re: hello',
                        html: '<p>Sounds good</p>',
                    }),
                }),
            }),
        );
        expect(prisma.interaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: InteractionType.NOTE,
                    contact_uuid: 'contact-uuid',
                    content: 'Reply received: Sounds good',
                }),
            }),
        );
        expect(prisma.marketingCampaign.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { replied_count: { increment: 1 } },
            }),
        );
        expect(prisma.contact.update).toHaveBeenCalled();
        expect(contactsService.buildPromoteToEngagedOnReplyOps).toHaveBeenCalledWith(
            'contact-uuid',
            organisation_uuid,
            LeadStatus.CONTACTED,
        );
        expect(prisma.contact.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { status: LeadStatus.ENGAGED } }),
        );
    });

    it('hands the conversation to us (AWAITING_US) when a reply lands on a threaded message', async () => {
        const { service, prisma } = createService({
            message: { status: MsgStatus.OPENED, thread_uuid: 'thread-uuid' },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: 'Sounds good' },
        });

        expect(prisma.messageThread.update).toHaveBeenCalledWith({
            where: { uuid: 'thread-uuid' },
            data: {
                last_inbound_at: expect.any(Date),
                reply_state: ThreadReplyState.AWAITING_US,
                has_unread_reply: true,
            },
        });
    });

    it('persists the inbound Message-ID so our reply can thread onto it', async () => {
        const { service, prisma } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: 'Sounds good', message_id: '<inbound-1@mail.example.com>' },
        });

        expect(prisma.outreachMessage.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ inbound_message_id: '<inbound-1@mail.example.com>' }),
            }),
        );
    });

    it('attributes a reply to the exact message the resolver identified, not just by provider id', async () => {
        const { service, prisma } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id: 'some-other-provider-id',
            metadata: { outreach_message_uuid: 'msg-uuid' },
            reply: { subject: 'Re: hello', text: 'Sounds good' },
        });

        expect(prisma.outreachMessage.findUnique).toHaveBeenCalledWith({ where: { uuid: 'msg-uuid' } });
        expect(prisma.outreachMessage.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { uuid: 'msg-uuid' },
                data: expect.objectContaining({ status: MsgStatus.REPLIED }),
            }),
        );
    });

    it('closes the thread out of follow-up tracking when a message bounces', async () => {
        const { service, prisma } = createService({
            message: { status: MsgStatus.SENT, thread_uuid: 'thread-uuid' },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.SENT },
        });

        await service.ingest({ kind: 'bounced', provider_message_id });

        expect(prisma.messageThread.update).toHaveBeenCalledWith({
            where: { uuid: 'thread-uuid' },
            data: { reply_state: ThreadReplyState.NONE },
        });
    });

    it('does not touch thread state for a delivery/open event', async () => {
        const { service, prisma } = createService({
            message: { thread_uuid: 'thread-uuid' },
        });

        await service.ingest({ kind: 'opened', provider_message_id });

        expect(prisma.messageThread.update).not.toHaveBeenCalled();
    });

    it('scopes the reply\'s follow-up cancellation to the conversation it landed on', async () => {
        const { service, remindersService } = createService({
            message: { status: MsgStatus.OPENED, thread_uuid: 'thread-uuid' },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: 'Sounds good' },
        });

        expect(remindersService.cancelPendingFollowUp).toHaveBeenCalledWith(
            organisation_uuid,
            'contact-uuid',
            'thread-uuid',
        );
    });

    it('enqueues a reply-analysis job for the placeholder note after a reply is ingested', async () => {
        const { service, replyAnalysisQueue } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
            contactStatus: LeadStatus.QUALIFIED,
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: 'Sounds good', html: '<p>Sounds good</p>' },
        });

        expect(replyAnalysisQueue.add).toHaveBeenCalledWith(
            'analyze',
            { message_uuid: 'msg-uuid', note_uuid: 'note-uuid' },
            expect.objectContaining({ attempts: 1 }),
        );
    });

    it('does not enqueue reply-analysis when the reply has no text', async () => {
        const { service, replyAnalysisQueue } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
            contactStatus: LeadStatus.QUALIFIED,
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: null },
        });

        expect(replyAnalysisQueue.add).not.toHaveBeenCalled();
    });

    it('does not fail ingest when enqueueing reply-analysis throws', async () => {
        const { service, replyAnalysisQueue } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
            contactStatus: LeadStatus.QUALIFIED,
        });
        replyAnalysisQueue.add.mockRejectedValueOnce(new Error('queue unavailable'));

        await expect(
            service.ingest({
                kind: 'replied',
                provider_message_id,
                reply: { subject: 'Re: hello', text: 'Sounds good' },
            }),
        ).resolves.toBeUndefined();
    });

    it('does not promote to ENGAGED when the contact has already moved past it', async () => {
        const { service, contactsService, prisma } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
            contactStatus: LeadStatus.QUALIFIED,
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: 'Sounds good', html: '<p>Sounds good</p>' },
        });

        expect(contactsService.buildPromoteToEngagedOnReplyOps).toHaveBeenCalledWith(
            'contact-uuid',
            organisation_uuid,
            LeadStatus.QUALIFIED,
        );
        expect(prisma.contact.update).not.toHaveBeenCalledWith(
            expect.objectContaining({ data: { status: LeadStatus.ENGAGED } }),
        );
    });

    it('preserves every reply as its own Interaction instead of overwriting the prior one', async () => {
        const { service, prisma } = createService({
            message: { status: MsgStatus.OPENED },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.OPENED },
            contactStatus: LeadStatus.QUALIFIED, // isolate reply-interaction creation from the ENGAGED promotion path
        });

        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: 'First reply', html: '<p>First reply</p>' },
        });
        await service.ingest({
            kind: 'replied',
            provider_message_id,
            reply: { subject: 'Re: hello', text: 'Second reply', html: '<p>Second reply</p>' },
        });

        // Each reply creates two Interactions: the REPLY_RECEIVED thread entry and a NOTE snapshot.
        expect(prisma.interaction.create).toHaveBeenCalledTimes(4);
        expect(prisma.interaction.create).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                data: expect.objectContaining({
                    type: InteractionType.REPLY_RECEIVED,
                    outreach_message_uuid: 'msg-uuid',
                    content: 'First reply',
                }),
            }),
        );
        expect(prisma.interaction.create).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                data: expect.objectContaining({
                    type: InteractionType.NOTE,
                    content: 'Reply received: First reply',
                }),
            }),
        );
        expect(prisma.interaction.create).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({
                data: expect.objectContaining({
                    type: InteractionType.REPLY_RECEIVED,
                    outreach_message_uuid: 'msg-uuid',
                    content: 'Second reply',
                }),
            }),
        );
        expect(prisma.interaction.create).toHaveBeenNthCalledWith(
            4,
            expect.objectContaining({
                data: expect.objectContaining({
                    type: InteractionType.NOTE,
                    content: 'Reply received: Second reply',
                }),
            }),
        );
    });

    it('records email bounce with timestamp and MCC error', async () => {
        const { service, prisma } = createService({
            message: { status: MsgStatus.SENT },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.SENT },
        });

        await service.ingest({
            kind: 'bounced',
            provider_message_id,
            metadata: { reason: 'Hard bounce' },
        });

        expect(prisma.outreachMessage.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: MsgStatus.BOUNCED,
                    bounced_at: expect.any(Date),
                }),
            }),
        );
        expect(prisma.marketingCampaignContact.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: CampaignContactStatus.BOUNCED,
                    error_message: 'Hard bounce',
                }),
            }),
        );
        expect(prisma.marketingCampaign.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { bounced_count: { increment: 1 } },
            }),
        );
    });

    it('records email failure with timestamp', async () => {
        const { service, prisma } = createService({
            message: { status: MsgStatus.SENT },
            mcc: { uuid: 'mcc-uuid', status: CampaignContactStatus.SENT },
        });

        await service.ingest({
            kind: 'failed',
            channel: 'email',
            provider_message_id,
            metadata: { reason: 'reached_daily_quota' },
        });

        expect(prisma.outreachMessage.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: MsgStatus.FAILED,
                    failed_at: expect.any(Date),
                }),
            }),
        );
        expect(prisma.interaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ type: InteractionType.EMAIL_FAILED }),
            }),
        );
    });

    it('resolves outbound message from Resend-style received email headers', async () => {
        const { service, prisma } = createService({
            receivedEmail: {
                headers: {
                    'in-reply-to': `<${provider_message_id}@resend.dev>`,
                },
            },
        });

        const resolved = await service.resolveOutboundMessageIdFromReceived(
            'received-id',
            'lead@example.com',
            organisation_uuid,
        );

        expect(resolved?.provider_message_id).toBe(provider_message_id);
        expect(prisma.outreachMessage.findFirst).toHaveBeenCalled();
    });

    it('resolves outbound message from SMTP-style (non-UUID) received email headers', async () => {
        const smtpMessageId = '<abc123@smtp-host.example.com>';
        const { service } = createService({
            message: { provider_message_id: smtpMessageId },
            receivedEmail: {
                headers: {
                    'in-reply-to': smtpMessageId,
                },
            },
        });

        const resolved = await service.resolveOutboundMessageIdFromReceived(
            'received-id',
            'lead@example.com',
            organisation_uuid,
        );

        expect(resolved?.provider_message_id).toBe(smtpMessageId);
    });

    it('resolves a reply by the Message-ID we generated when it differs from the provider id', async () => {
        const ourMessageId = '11111111-2222-3333-4444-555555555555@leadmind.app';
        const { service, prisma } = createService({
            message: { provider_message_id: 'resend-assigned-id', message_id: ourMessageId },
            receivedEmail: { headers: { 'in-reply-to': `<${ourMessageId}>` } },
        });

        const resolved = await service.resolveOutboundMessageIdFromReceived(
            'received-id',
            'lead@example.com',
            organisation_uuid,
        );

        expect(resolved).toEqual(
            expect.objectContaining({
                provider_message_id: 'resend-assigned-id',
                outreach_message_uuid: 'msg-uuid',
            }),
        );
        // Matched from the headers - the "latest message to that contact" guess was never needed.
        expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    });

    it('does not cross-match an outbound message belonging to a different organisation', async () => {
        const { service, prisma } = createService({
            receivedEmail: {
                headers: {
                    'in-reply-to': `<${provider_message_id}@resend.dev>`,
                },
            },
            contact: { uuid: 'contact-uuid', organisation_uuid },
        });

        const resolved = await service.resolveOutboundMessageIdFromReceived(
            'received-id',
            'lead@example.com',
            'other-org-uuid',
        );

        expect(resolved).toBeNull();
        expect(prisma.contact.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ organisation_uuid: 'other-org-uuid' }),
            }),
        );
    });

    it('falls back to the most recent message to the contact within the same organisation', async () => {
        const { service } = createService({
            receivedEmail: { headers: {} },
        });

        const resolved = await service.resolveOutboundMessageIdFromReceived(
            'received-id',
            'lead@example.com',
            organisation_uuid,
        );

        expect(resolved?.provider_message_id).toBe(provider_message_id);
        expect(resolved?.outreach_message_uuid).toBe('msg-uuid');
    });
});
