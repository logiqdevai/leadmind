import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Channel, MarketingCampaign, OrgTagEntityType, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgTagsService } from '@/modules/org-tags/org-tags.service';
import { isEmailHtmlEmpty, sanitizeEmailHtml } from '@/shared/utils/sanitize-html.util';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { ListMessageTemplatesDto } from './dto/list-message-templates.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { CreateTemplateFromSourceDto } from './dto/create-template-from-source.dto';
import { GenerateTemplateMessageDto } from './dto/generate-template-message.dto';
import { TemplateAiService } from './services/template-ai.service';

function deriveChannelsFromContent(input: {
    email_content?: string | null;
    sms_content?: string | null;
}): Channel[] {
    const channels: Channel[] = [];
    if (input.email_content && !isEmailHtmlEmpty(input.email_content)) channels.push(Channel.EMAIL);
    if (input.sms_content?.trim()) channels.push(Channel.SMS);
    return channels;
}

function normalizeTemplateData(dto: CreateMessageTemplateDto | UpdateMessageTemplateDto) {
    const emailSubject = dto.email_subject?.trim() || null;
    const emailContent =
        dto.email_content && !isEmailHtmlEmpty(dto.email_content)
            ? sanitizeEmailHtml(dto.email_content)
            : null;
    const smsContent = dto.sms_content?.trim() || null;

    if (dto.channels?.includes(Channel.EMAIL) && !emailContent) {
        throw new BadRequestException('Email content is required when EMAIL channel is selected');
    }
    if (dto.channels?.includes(Channel.SMS) && !smsContent) {
        throw new BadRequestException('SMS content is required when SMS channel is selected');
    }

    return { emailSubject, emailContent, smsContent };
}

@Injectable()
export class MessageTemplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly templateAiService: TemplateAiService,
        private readonly orgTags: OrgTagsService,
    ) {}

    private async withTags<T extends { uuid: string }>(organisation_uuid: string, template: T) {
        const [withTags] = await this.orgTags.withTags(organisation_uuid, OrgTagEntityType.MESSAGE_TEMPLATE, [template]);
        return withTags;
    }

    private async assertSenderProfileInOrg(organisation_uuid: string, sender_profile_uuid: string) {
        const profile = await this.prisma.senderProfile.findFirst({
            where: { uuid: sender_profile_uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!profile) throw new NotFoundException(`Sender profile ${sender_profile_uuid} not found`);
    }

    private async assertBookingPageInOrg(organisation_uuid: string, booking_page_uuid: string) {
        const page = await this.prisma.bookingPage.findFirst({
            where: { uuid: booking_page_uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!page) throw new NotFoundException(`Booking page ${booking_page_uuid} not found`);
    }

    async create(organisation_uuid: string, dto: CreateMessageTemplateDto) {
        const { emailSubject, emailContent, smsContent } = normalizeTemplateData(dto);
        if (dto.sender_profile_uuid) {
            await this.assertSenderProfileInOrg(organisation_uuid, dto.sender_profile_uuid);
        }
        if (dto.booking_page_uuid) {
            await this.assertBookingPageInOrg(organisation_uuid, dto.booking_page_uuid);
        }
        // Validate tags up front so a bad tag uuid doesn't leave an untagged template behind.
        if (dto.tag_uuids?.length) await this.orgTags.assertTagsOwned(organisation_uuid, dto.tag_uuids);
        const template = await this.prisma.messageTemplate.create({
            data: {
                organisation_uuid,
                name: dto.name.trim(),
                channels: dto.channels,
                email_subject: emailSubject,
                email_content: emailContent,
                sms_content: smsContent,
                sender_profile_uuid: dto.sender_profile_uuid ?? null,
                booking_page_uuid: dto.booking_page_uuid ?? null,
                append_booking_cta: dto.append_booking_cta ?? false,
            },
        });
        if (dto.tag_uuids?.length) {
            await this.orgTags.setTags(organisation_uuid, OrgTagEntityType.MESSAGE_TEMPLATE, template.uuid, dto.tag_uuids);
        }
        return this.withTags(organisation_uuid, template);
    }

    async findAll(organisation_uuid: string, filters: ListMessageTemplatesDto = {}) {
        const where: Prisma.MessageTemplateWhereInput = { organisation_uuid };
        const tagWhere = await this.orgTags.buildWhere(organisation_uuid, OrgTagEntityType.MESSAGE_TEMPLATE, filters);
        if (tagWhere) where.uuid = tagWhere.uuid;

        const rows = await this.prisma.messageTemplate.findMany({ where, orderBy: { updated_at: 'desc' } });
        return this.orgTags.withTags(organisation_uuid, OrgTagEntityType.MESSAGE_TEMPLATE, rows);
    }

    private async requireOwned(organisation_uuid: string, uuid: string) {
        const row = await this.prisma.messageTemplate.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!row) throw new NotFoundException(`Message template ${uuid} not found`);
        return row;
    }

    async findOne(organisation_uuid: string, uuid: string) {
        return this.withTags(organisation_uuid, await this.requireOwned(organisation_uuid, uuid));
    }

    async update(organisation_uuid: string, uuid: string, dto: UpdateMessageTemplateDto) {
        const existing = await this.requireOwned(organisation_uuid, uuid);
        const merged: CreateMessageTemplateDto = {
            name: dto.name ?? existing.name,
            channels: dto.channels ?? existing.channels,
            email_subject: dto.email_subject ?? existing.email_subject ?? undefined,
            email_content: dto.email_content ?? existing.email_content ?? undefined,
            sms_content: dto.sms_content ?? existing.sms_content ?? undefined,
        };
        const { emailSubject, emailContent, smsContent } = normalizeTemplateData(merged);
        if (dto.sender_profile_uuid) {
            await this.assertSenderProfileInOrg(organisation_uuid, dto.sender_profile_uuid);
        }
        if (dto.booking_page_uuid) {
            await this.assertBookingPageInOrg(organisation_uuid, dto.booking_page_uuid);
        }

        if (dto.tag_uuids !== undefined) {
            await this.orgTags.setTags(organisation_uuid, OrgTagEntityType.MESSAGE_TEMPLATE, uuid, dto.tag_uuids);
        }

        const updated = await this.prisma.messageTemplate.update({
            where: { uuid },
            data: {
                ...(dto.name !== undefined && { name: dto.name.trim() }),
                ...(dto.channels !== undefined && { channels: dto.channels }),
                ...(dto.email_subject !== undefined && { email_subject: emailSubject }),
                ...(dto.email_content !== undefined && { email_content: emailContent }),
                ...(dto.sms_content !== undefined && { sms_content: smsContent }),
                ...(dto.sender_profile_uuid !== undefined && { sender_profile_uuid: dto.sender_profile_uuid }),
                ...(dto.booking_page_uuid !== undefined && { booking_page_uuid: dto.booking_page_uuid }),
                ...(dto.append_booking_cta !== undefined && { append_booking_cta: dto.append_booking_cta }),
            },
        });
        return this.withTags(organisation_uuid, updated);
    }

    async remove(organisation_uuid: string, uuid: string) {
        await this.requireOwned(organisation_uuid, uuid);
        await this.prisma.messageTemplate.delete({ where: { uuid } });
        await this.orgTags.deleteForEntities(OrgTagEntityType.MESSAGE_TEMPLATE, [uuid]);
        return { uuid };
    }

    async generateAi(organisation_uuid: string, dto: GenerateTemplateMessageDto) {
        return this.templateAiService.generate(organisation_uuid, dto, {});
    }

    private async resolveCampaignTemplateContent(
        organisation_uuid: string,
        campaign: MarketingCampaign,
    ): Promise<{
        emailSubject: string | null;
        emailContent: string | null;
        smsContent: string | null;
    }> {
        let emailSubject = campaign.email_subject?.trim() || null;
        let emailContent =
            campaign.email_content && !isEmailHtmlEmpty(campaign.email_content)
                ? campaign.email_content
                : null;
        let smsContent = campaign.sms_content?.trim() || null;

        if (!emailContent) {
            const emailDraft = await this.prisma.outreachMessage.findFirst({
                where: {
                    campaign_uuid: campaign.uuid,
                    organisation_uuid,
                    channel: Channel.EMAIL,
                    content: { not: '' },
                },
                orderBy: { created_at: 'asc' },
            });

            if (emailDraft?.content.trim() && !isEmailHtmlEmpty(emailDraft.content)) {
                emailSubject = emailDraft.subject?.trim() || emailSubject;
                emailContent = emailDraft.content;
            }
        }

        if (!smsContent) {
            const smsDraft = await this.prisma.outreachMessage.findFirst({
                where: {
                    campaign_uuid: campaign.uuid,
                    organisation_uuid,
                    channel: Channel.SMS,
                    content: { not: '' },
                },
                orderBy: { created_at: 'asc' },
            });

            if (smsDraft?.content.trim()) {
                smsContent = smsDraft.content.trim();
            }
        }

        return { emailSubject, emailContent, smsContent };
    }

    async createFromCampaign(
        organisation_uuid: string,
        campaign_uuid: string,
        dto: CreateTemplateFromSourceDto,
    ) {
        const campaign = await this.prisma.marketingCampaign.findFirst({
            where: { uuid: campaign_uuid, organisation_uuid },
        });
        if (!campaign) throw new NotFoundException(`Campaign ${campaign_uuid} not found`);

        const { emailSubject, emailContent, smsContent } = await this.resolveCampaignTemplateContent(
            organisation_uuid,
            campaign,
        );

        if (!emailContent && !smsContent) {
            throw new BadRequestException('Campaign has no email or SMS content to save as a template');
        }

        const channels = deriveChannelsFromContent({ email_content: emailContent, sms_content: smsContent });
        const name = dto.name?.trim() || `${campaign.name} template`;

        return this.prisma.messageTemplate.create({
            data: {
                organisation_uuid,
                name,
                channels,
                email_subject: channels.includes(Channel.EMAIL) ? emailSubject : null,
                email_content: emailContent,
                sms_content: smsContent,
                source_campaign_uuid: campaign.uuid,
                sender_profile_uuid: campaign.sender_profile_uuid,
            },
        });
    }

    async createFromMessage(
        organisation_uuid: string,
        message_uuid: string,
        dto: CreateTemplateFromSourceDto,
    ) {
        const message = await this.prisma.outreachMessage.findFirst({
            where: { uuid: message_uuid, organisation_uuid },
            include: { campaign: { select: { name: true } } },
        });
        if (!message) throw new NotFoundException(`Message ${message_uuid} not found`);

        if (message.channel !== Channel.EMAIL && message.channel !== Channel.SMS) {
            throw new BadRequestException('Only email and SMS messages can be saved as templates');
        }

        const content = message.content.trim();
        if (!content) {
            throw new BadRequestException('Message has no content to save as a template');
        }

        const defaultName = message.campaign?.name
            ? `${message.campaign.name} message`
            : `${message.channel} template`;
        const name = dto.name?.trim() || defaultName;

        return this.prisma.messageTemplate.create({
            data: {
                organisation_uuid,
                name,
                channels: [message.channel],
                email_subject: message.channel === Channel.EMAIL ? message.subject?.trim() || null : null,
                email_content: message.channel === Channel.EMAIL ? content : null,
                sms_content: message.channel === Channel.SMS ? content : null,
                source_campaign_uuid: message.campaign_uuid,
                source_message_uuid: message.uuid,
            },
        });
    }
}
