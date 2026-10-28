import { Injectable } from '@nestjs/common';
import { Channel, Contact, SenderProfile } from '@/generated/prisma';
import { BookingLinksService } from '@/modules/booking-links/booking-links.service';
import { parseBookingPageMetadata } from '@/modules/booking-links/utils/booking-page-metadata.util';
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
    constructor(
        private readonly senderProfilesService: SenderProfilesService,
        private readonly bookingLinksService: BookingLinksService,
    ) { }

    async buildVarsForUser(organisation_uuid: string): Promise<PlaceholderVars> {
        const profile = await this.senderProfilesService.findDefault(organisation_uuid);
        return this.buildVarsForProfile(profile);
    }

    /** Sender variables (incl. signature) of a team member's linked profile, else the default profile. */
    async buildVarsForTeamMember(organisation_uuid: string, user_uuid?: string | null): Promise<PlaceholderVars> {
        const profile = await this.senderProfilesService.findForUser(organisation_uuid, user_uuid);
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
        content = '',
    ): Promise<PlaceholderVars> {
        const senderVars = await this.buildVarsForOutreachMessage(organisation_uuid, campaign_uuid);
        const vars: PlaceholderVars = { ...senderVars, ...contactToPlaceholders(contact) };
        const booking = await this.bookingLinksService.resolveForOutgoingEmail(organisation_uuid, contact.uuid, content, {
            allow_cta: false,
        });
        if (booking.booking_link) vars.booking_link = booking.booking_link;
        return vars;
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
        message: RenderableMessage & {
            campaign_uuid?: string | null;
            metadata?: unknown;
            sequence_step_uuid?: string | null;
            channel?: Channel;
        },
        contact?: Contact | null,
    ): Promise<RenderedMessage> {
        const senderVars = await this.buildVarsForOutreachMessage(
            organisation_uuid,
            message.campaign_uuid,
            message.metadata,
        );
        const vars = contact ? { ...senderVars, ...contactToPlaceholders(contact) } : senderVars;
        if (contact) {
            // Each recipient gets their own contact-specific link (reused across emails, never shared).
            const booking = await this.bookingLinksService.resolveForOutgoingEmail(
                organisation_uuid,
                contact.uuid,
                message.content,
                {
                    sequence_step_uuid: message.sequence_step_uuid,
                    booking_page_uuid: parseBookingPageMetadata(message.metadata),
                    allow_cta: message.channel !== Channel.SMS,
                },
            );
            message = { ...message, content: booking.content };
            if (booking.booking_link) vars.booking_link = booking.booking_link;
        }
        const rendered = this.render(message, vars);
        if (vars.signature && !/\{\{\s*signature\s*\}\}/.test(message.content)) {
            rendered.content = `${rendered.content}<p>&nbsp;</p><p>&nbsp;</p>${vars.signature}`;
        }
        return rendered;
    }

    async renderForCampaignDraft(
        organisation_uuid: string,
        campaign_uuid: string,
        contact: Contact,
        message: RenderableMessage,
    ): Promise<RenderedMessage> {
        const vars = await this.buildVarsForCampaignDraft(organisation_uuid, campaign_uuid, contact, message.content);
        return this.render(message, vars);
    }
}
