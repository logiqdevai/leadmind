import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
    Channel,
    Contact,
    ExternalIntegrationProvider,
    InteractionType,
    MsgStatus,
    OutreachMessage,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ResendMailService } from '@/integrations/notifications/resend/services/mail.service';
import { SmtpMailService } from '@/integrations/notifications/smtp/services/mail.service';
import { CallsService } from '@/integrations/notifications/twillio/services/calls.service';
import { TwillioSmsService } from '@/integrations/notifications/twillio/services/sms.service';
import { EmailConfig } from '@/shared/config/email';
import { hasUsableContactEmail, isEmailValidationBlocked, normalizeContactEmail } from '@/shared/utils/contact-email.util';
import { sanitizeEmailHtml } from '@/shared/utils/sanitize-html.util';
import { applySmtpEmailTracking } from '@/shared/utils/email-tracking.util';
import { EmailCredentialsService } from '@/modules/integrations/services/email-credentials.service';
import { EmailProviderTarget } from '@/modules/integrations/interfaces/email-credentials.interface';
import { SenderProfilesService } from '@/modules/sender-profiles/sender-profiles.service';
import { EmailSendLimitsService } from '@/modules/email-send-limits/email-send-limits.service';
import {
    buildEmailProviderMetadata,
    parseEmailProviderMetadata,
} from '@/modules/outreach/utils/email-provider-allocation.util';
import { parseSenderProfileMetadata } from '@/modules/outreach/utils/sender-profile-metadata.util';
import { formatSmtpFromAddress } from '@/integrations/notifications/smtp/utils/format-smtp-from-address.util';
import { OutreachRenderService } from './outreach-render.service';
export interface DeliveredMessage {
    provider_message_id: string | null;
    integration_metadata?: Record<string, string>;
}

@Injectable()
export class MessageSendService {
    private readonly logger = new Logger(MessageSendService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly resendMailService: ResendMailService,
        private readonly smtpMailService: SmtpMailService,
        private readonly emailCredentialsService: EmailCredentialsService,
        private readonly twillioSmsService: TwillioSmsService,
        private readonly callsService: CallsService,
        private readonly outreachRenderService: OutreachRenderService,
        private readonly senderProfilesService: SenderProfilesService,
        private readonly emailSendLimitsService: EmailSendLimitsService,
    ) { }

    async deliverOutreachMessage(
        message: OutreachMessage & { contact: Contact },
        providerOverride?: EmailProviderTarget,
    ): Promise<DeliveredMessage> {
        this.logger.log(
            `Deliver outreach message=${message.uuid} channel=${message.channel} user=${message.organisation_uuid} contact=${message.contact_uuid}`,
        );

        if (message.channel === Channel.EMAIL && !hasUsableContactEmail(message.contact.email)) {
            this.logger.warn(
                `Skip email send message=${message.uuid} contact=${message.contact_uuid}: no usable email (raw=${JSON.stringify(message.contact.email)})`,
            );
            throw new Error('Contact has no email');
        }

        if (
            message.channel === Channel.EMAIL &&
            isEmailValidationBlocked(message.contact.email_validation_status)
        ) {
            this.logger.warn(
                `Skip email send message=${message.uuid} contact=${message.contact_uuid}: email failed validation (reason=${message.contact.email_validation_reason})`,
            );
            throw new Error('Contact email failed validation');
        }

        if (message.channel === Channel.PHONE_CALL) {
            if (!message.contact.phone) {
                throw new Error('Contact has no phone');
            }
            const script = message.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!script) {
                throw new Error('Call script cannot be empty');
            }
            const result: any = await this.callsService.makeCall({
                to: message.contact.phone,
                message: script,
            });
            const provider_message_id = result?.sid ?? null;
            return { provider_message_id };
        }

        const rendered = await this.outreachRenderService.renderForOutreachMessage(
            message.organisation_uuid,
            {
                subject: message.subject,
                content: message.content,
                campaign_uuid: message.campaign_uuid,
                metadata: message.metadata,
            },
            message.contact,
        );

        if (message.channel === Channel.EMAIL) {
            if (message.contact.unsubscribed_at) {
                throw new Error('Contact has unsubscribed');
            }
            const toEmail = normalizeContactEmail(message.contact.email)!;
            let html = sanitizeEmailHtml(rendered.content);
            const token = await this.getOrCreateUnsubscribeToken(message.contact_uuid);
            html = this.appendUnsubscribeFooter(html, token);
            const headers: Record<string, string> = {
                'X-Message-Uuid': message.uuid,
                ...this.unsubscribeHeaders(token),
            };
            if (message.campaign_uuid) {
                headers['X-Campaign-Uuid'] = message.campaign_uuid;
            }
            const replyTo = await this.resolveReplyTo(message);
            const createEmail = {
                to: toEmail,
                subject: rendered.subject ?? 'Outreach message',
                html,
                headers,
                replyTo,
            };

            const metadataProvider = parseEmailProviderMetadata(message.metadata);
            const defaultTarget =
                providerOverride || metadataProvider
                    ? null
                    : await this.emailCredentialsService.resolveDefaultTarget(message.organisation_uuid);

            const target = providerOverride ?? metadataProvider ?? defaultTarget;

            if (!message.campaign_uuid && target?.provider) {
                await this.emailSendLimitsService.assertWithinLimit(
                    message.organisation_uuid,
                    target.provider,
                );
            }

            if (target?.provider === ExternalIntegrationProvider.SMTP) {
                createEmail.html = this.applySmtpTracking(message.uuid, createEmail.html);
            }

            this.logger.log(
                `Email send message=${message.uuid} to=${toEmail} subject="${rendered.subject ?? 'Outreach message'}" provider=${target?.provider ?? 'none'} account=${target?.account ?? 'none'} replyTo=${replyTo}`,
            );

            const { result, deliveryTarget } = await this.sendEmailWithProvider(
                message.organisation_uuid,
                createEmail,
                target,
            );
            const provider_message_id =
                result?.data?.id ?? result?.id ?? null;
            if (!provider_message_id) {
                this.logger.error(
                    `Email provider returned no message id message=${message.uuid} provider=${deliveryTarget.provider} account=${deliveryTarget.account} result=${JSON.stringify(result)}`,
                );
                throw new Error('Email provider did not confirm delivery');
            }
            this.logger.log(
                `Email delivered message=${message.uuid} providerMessageId=${provider_message_id}`,
            );
            return {
                provider_message_id,
                integration_metadata: buildEmailProviderMetadata(deliveryTarget),
            };
        }

        if (message.channel === Channel.SMS) {
            if (!message.contact.phone) {
                throw new Error('Contact has no phone');
            }
            const result: any = await this.twillioSmsService.sendSms({
                to: message.contact.phone,
                body: rendered.content,
            });
            const provider_message_id = result?.sid ?? null;
            return {
                provider_message_id,
                integration_metadata: { sms_provider: 'TWILIO' },
            };
        }

        throw new Error(`Channel ${message.channel} not implemented`);
    }

    private async sendEmailWithProvider(
        organisation_uuid: string,
        createEmail: {
            to: string;
            subject: string;
            html: string;
            headers: Record<string, string>;
            replyTo: string;
        },
        target: EmailProviderTarget | null,
    ): Promise<{ result: any; deliveryTarget: EmailProviderTarget }> {
        if (target?.provider === ExternalIntegrationProvider.SMTP) {
            const smtpConfig = await this.emailCredentialsService.getSmtpConfig(
                organisation_uuid,
                target.account,
            );
            const from = formatSmtpFromAddress(
                smtpConfig.fromEmail,
                smtpConfig.fromName,
            );
            const result = await this.smtpMailService.sendEmail(
                { ...createEmail, from },
                smtpConfig,
            );
            return { result, deliveryTarget: target };
        }

        if (target?.provider === ExternalIntegrationProvider.RESEND) {
            this.logger.log(
                `Using Resend account=${target.account} user=${organisation_uuid} to=${createEmail.to}`,
            );
            const [apiKey, fromEmail] = await Promise.all([
                this.emailCredentialsService.getResendApiKey(organisation_uuid, target.account),
                this.emailCredentialsService.getResendFromEmail(organisation_uuid, target.account, target.domain_uuid),
            ]);
            const result = await this.resendMailService.sendEmail(
                { ...createEmail, from: fromEmail },
                apiKey,
            );
            return { result, deliveryTarget: target };
        }

        const envKey = this.configService.get<string>('RESEND_API_KEY');
        if (envKey) {
            this.logger.log(
                `Using Resend env RESEND_API_KEY to=${createEmail.to} (no integration target)`,
            );
            const result = await this.resendMailService.sendEmail(createEmail, envKey);
            return {
                result,
                deliveryTarget: {
                    provider: ExternalIntegrationProvider.RESEND,
                    account: 'env',
                },
            };
        }

        this.logger.error(
            `No email provider configured user=${organisation_uuid} to=${createEmail.to} target=${JSON.stringify(target)} envResend=${envKey ? 'set' : 'missing'}`,
        );
        throw new Error('No email provider configured');
    }

    private integrationColumnsFromMetadata(
        integration_metadata?: Record<string, string>,
    ): Pick<
        Prisma.OutreachMessageUpdateInput,
        'email_provider' | 'email_account' | 'email_domain_uuid' | 'sms_provider'
    > {
        if (!integration_metadata) {
            return {
                email_provider: null,
                email_account: null,
                email_domain_uuid: null,
                sms_provider: null,
            };
        }

        const emailProvider = integration_metadata.email_provider;
        const emailAccount = integration_metadata.email_account;
        const emailDomainUuid = integration_metadata.email_domain_uuid;
        const smsProvider = integration_metadata.sms_provider;

        return {
            email_provider:
                emailProvider === ExternalIntegrationProvider.RESEND ||
                emailProvider === ExternalIntegrationProvider.SMTP
                    ? emailProvider
                    : null,
            email_account: emailAccount ?? null,
            email_domain_uuid: emailDomainUuid ?? null,
            sms_provider: smsProvider ?? null,
        };
    }

    buildSentMetadata(
        existing: unknown,
        integration_metadata?: Record<string, string>,
    ): Prisma.InputJsonValue | typeof Prisma.DbNull {
        const base =
            existing && typeof existing === 'object' && !Array.isArray(existing)
                ? { ...(existing as Record<string, unknown>) }
                : {};
        delete base.error;
        if (integration_metadata) {
            Object.assign(base, integration_metadata);
        }
        return Object.keys(base).length > 0 ? (base as Prisma.InputJsonValue) : Prisma.DbNull;
    }

    messageSentOperation(
        message_uuid: string,
        provider_message_id: string | null,
        existingMetadata: unknown,
        integration_metadata?: Record<string, string>,
    ) {
        const metadata = this.buildSentMetadata(existingMetadata, integration_metadata);
        return this.prisma.outreachMessage.update({
            where: { uuid: message_uuid },
            data: {
                status: MsgStatus.SENT,
                sent_at: new Date(),
                provider_message_id,
                metadata,
                ...this.integrationColumnsFromMetadata(integration_metadata),
            },
        });
    }

    messageFailedOperation(message_uuid: string, error_message: string) {
        return this.prisma.outreachMessage.update({
            where: { uuid: message_uuid },
            data: {
                status: MsgStatus.FAILED,
                failed_at: new Date(),
                sent_at: null,
                provider_message_id: null,
                metadata: { error: error_message } as Prisma.InputJsonValue,
            },
        });
    }

    messageFailedOperationPreservingProvider(
        message_uuid: string,
        error_message: string,
        existingMetadata?: unknown,
    ) {
        const provider = parseEmailProviderMetadata(existingMetadata ?? null);
        const metadata: Record<string, unknown> = { error: error_message };
        const integration_metadata: Record<string, string> = {};
        if (provider) {
            metadata.email_provider = provider.provider;
            metadata.email_account = provider.account;
            integration_metadata.email_provider = provider.provider;
            integration_metadata.email_account = provider.account;
            if (provider.domain_uuid) {
                metadata.email_domain_uuid = provider.domain_uuid;
                integration_metadata.email_domain_uuid = provider.domain_uuid;
            }
        }
        return this.prisma.outreachMessage.update({
            where: { uuid: message_uuid },
            data: {
                status: MsgStatus.FAILED,
                failed_at: new Date(),
                sent_at: null,
                provider_message_id: null,
                metadata: metadata as Prisma.InputJsonValue,
                ...this.integrationColumnsFromMetadata(integration_metadata),
            },
        });
    }

    contactInteractedOperation(contact_uuid: string) {
        return this.prisma.contact.update({
            where: { uuid: contact_uuid },
            data: { last_interaction_at: new Date() },
        });
    }

    interactionCreateOperation(data: {
        contact_uuid: string;
        organisation_uuid: string;
        type: InteractionType;
        outreach_message_uuid?: string;
        campaign_uuid?: string;
        metadata?: Prisma.InputJsonValue;
    }) {
        return this.prisma.interaction.create({ data });
    }

    async getOrCreateUnsubscribeToken(contact_uuid: string): Promise<string> {
        const contact = await this.prisma.contact.findUnique({
            where: { uuid: contact_uuid },
            select: { unsubscribe_token: true },
        });
        if (contact?.unsubscribe_token) {
            return contact.unsubscribe_token;
        }
        const token = crypto.randomBytes(24).toString('hex');
        try {
            await this.prisma.contact.update({
                where: { uuid: contact_uuid },
                data: { unsubscribe_token: token },
            });
            return token;
        } catch {
            const reread = await this.prisma.contact.findUnique({
                where: { uuid: contact_uuid },
                select: { unsubscribe_token: true },
            });
            return reread?.unsubscribe_token ?? token;
        }
    }

    private async resolveReplyTo(message: OutreachMessage): Promise<string> {
        const organisation = await this.prisma.organisation.findUnique({
            where: { uuid: message.organisation_uuid },
            select: { reply_to_email: true },
        });
        if (organisation?.reply_to_email?.trim()) {
            return organisation.reply_to_email.trim();
        }

        const metadataUuid = parseSenderProfileMetadata(message.metadata);
        if (metadataUuid) {
            try {
                const profile = await this.senderProfilesService.findOne(
                    message.organisation_uuid,
                    metadataUuid,
                );
                if (profile.email?.trim()) {
                    return profile.email.trim();
                }
            } catch {
                // fall through
            }
        }

        if (message.campaign_uuid) {
            const campaign = await this.prisma.marketingCampaign.findUnique({
                where: { uuid: message.campaign_uuid },
                select: { sender_profile: { select: { email: true } } },
            });
            if (campaign?.sender_profile?.email?.trim()) {
                return campaign.sender_profile.email.trim();
            }
        }

        const defaultProfile = await this.senderProfilesService.findDefault(message.organisation_uuid);
        if (defaultProfile?.email?.trim()) {
            return defaultProfile.email.trim();
        }

        return EmailConfig.email_addresses.confirmation;
    }

    private stripTrailingSlash(url: string): string {
        return url.replace(/\/$/, '');
    }

    private publicUnsubscribeUrl(token: string): string {
        const app = this.configService.get<string>('APP_URL') || '';
        const api = this.configService.get<string>('API_URL') || '';
        const base = this.stripTrailingSlash(app || api);
        return `${base}/unsubscribe/${token}`;
    }

    private apiUnsubscribeUrl(token: string): string {
        const api = this.configService.get<string>('API_URL') || '';
        const app = this.configService.get<string>('APP_URL') || '';
        const base = this.stripTrailingSlash(api || app);
        return `${base}/unsubscribe/${token}`;
    }

    private unsubscribeHeaders(token: string): Record<string, string> {
        const apiUrl = this.apiUnsubscribeUrl(token);
        return {
            'List-Unsubscribe': `<${apiUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        };
    }

    private appendUnsubscribeFooter(html: string, token: string): string {
        if (/\/unsubscribe\//i.test(html)) {
            return html;
        }
        const url = this.publicUnsubscribeUrl(token);
        return `${html}<hr style="margin-top:24px;border:none;border-top:1px solid #eee"/><p style="font-size:12px;color:#888;text-align:center;margin-top:12px">Don't want these emails? <a href="${url}" style="color:#888">Unsubscribe</a>.</p>`;
    }

    private applySmtpTracking(messageUuid: string, html: string): string {
        const apiBase =
            this.configService.get<string>('API_URL') ||
            this.configService.get<string>('PUBLIC_API_URL') ||
            '';
        const secret = this.configService.get<string>('JWT_SECRET') || '';
        if (!apiBase || !secret) {
            this.logger.warn(
                `SMTP tracking skipped message=${messageUuid}: missing API_URL or JWT_SECRET`,
            );
            return html;
        }
        return applySmtpEmailTracking({
            html,
            messageUuid,
            apiBase,
            secret,
        });
    }
}
