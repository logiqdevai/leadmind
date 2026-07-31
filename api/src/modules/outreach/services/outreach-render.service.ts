import { Injectable } from '@nestjs/common';
import { Contact, SenderProfile } from '@/generated/prisma';
import { contactToPlaceholders } from '@/modules/contacts/utils/contact-placeholders.util';
import {
    renderPlaceholders,
    type PlaceholderVars,
} from '@/shared/utils/placeholder-render.util';
import { SenderProfilesService } from '@/modules/sender-profiles/sender-profiles.service';
import { senderProfileToPlaceholders } from '@/modules/sender-profiles/utils/sender-profile-placeholders.util';
import { parseSenderProfileMetadata } from '@/modules/outreach/utils/sender-profile-metadata.util';

export interface RenderableMessage {
    subject?: string | null;
    content: string;
}

export interface RenderedMessage {
    subject: string | null;
    content: string;
}

@Injectable()
export class OutreachRenderService {
    constructor(private readonly senderProfilesService: SenderProfilesService) { }

    async buildVarsForUser(organisation_uuid: string): Promise<PlaceholderVars> {
        const profile = await this.senderProfilesService.findDefault(organisation_uuid);
        return this.buildVarsForProfile(profile);
    }

    buildVarsForProfile(
        profile: SenderProfile | null | undefined,
        options?: { campaignUuid?: string | null },
    ): PlaceholderVars {
        return senderProfileToPlaceholders(profile, options);
    }

    async buildVarsForOutreachMessage(
        organisation_uuid: string,
        campaign_uuid?: string | null,
        messageMetadata?: unknown,
    ): Promise<PlaceholderVars> {
        const metadataUuid = parseSenderProfileMetadata(messageMetadata);
        if (metadataUuid) {
            try {
                const profile = await this.senderProfilesService.findOne(organisation_uuid, metadataUuid);
                return senderProfileToPlaceholders(profile, { campaignUuid: campaign_uuid });
            } catch {
                // fall through if profile was deleted
            }
        }
        const profile = campaign_uuid
            ? await this.senderProfilesService.findForCampaign(organisation_uuid, campaign_uuid)
            : await this.senderProfilesService.findDefault(organisation_uuid);
        return senderProfileToPlaceholders(profile, { campaignUuid: campaign_uuid });
    }

    async buildVarsForCampaignDraft(
        organisation_uuid: string,
        campaign_uuid: string,
        contact: Contact,
    ): Promise<PlaceholderVars> {
        const senderVars = await this.buildVarsForOutreachMessage(organisation_uuid, campaign_uuid);
        return { ...senderVars, ...contactToPlaceholders(contact) };
    }

    render(message: RenderableMessage, vars: PlaceholderVars): RenderedMessage {
        return {
            subject: message.subject ? renderPlaceholders(message.subject, vars) : null,
            content: renderPlaceholders(message.content, vars),
        };
    }

    async renderForUser(organisation_uuid: string, message: RenderableMessage): Promise<RenderedMessage> {
        const vars = await this.buildVarsForUser(organisation_uuid);
        return this.render(message, vars);
    }

    async renderForOutreachMessage(
        organisation_uuid: string,
        message: RenderableMessage & { campaign_uuid?: string | null; metadata?: unknown },
        contact?: Contact | null,
    ): Promise<RenderedMessage> {
        const senderVars = await this.buildVarsForOutreachMessage(
            organisation_uuid,
            message.campaign_uuid,
            message.metadata,
        );
        const vars = contact ? { ...senderVars, ...contactToPlaceholders(contact) } : senderVars;
        return this.render(message, vars);
    }

    async renderForCampaignDraft(
        organisation_uuid: string,
        campaign_uuid: string,
        contact: Contact,
        message: RenderableMessage,
    ): Promise<RenderedMessage> {
        const vars = await this.buildVarsForCampaignDraft(organisation_uuid, campaign_uuid, contact);
        return this.render(message, vars);
    }
}
