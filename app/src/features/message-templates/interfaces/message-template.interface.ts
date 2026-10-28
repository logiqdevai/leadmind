import { Channel } from "@/features/contacts/interfaces/contact.interface";
import type { OrgTagSummary, TagFilterQuery } from "@/features/org-tags/interfaces/org-tag.interface";

export type ListMessageTemplatesQuery = TagFilterQuery;

export interface MessageTemplate {
    uuid: string;
    user_uuid: string;
    name: string;
    channels: Channel[];
    email_subject: string | null;
    email_content: string | null;
    sms_content: string | null;
    source_campaign_uuid: string | null;
    source_message_uuid: string | null;
    sender_profile_uuid: string | null;
    /** Booking page `{{booking_link}}` resolves to (null = organisation default page). */
    booking_page_uuid: string | null;
    /** Append a booking button when the email has no `{{booking_link}}`. */
    append_booking_cta: boolean;
    tags?: OrgTagSummary[];
    /** Language the content is written in (ISO 639-1); booking emails pick the template matching the invitee. */
    language: string;
    created_at: string;
    updated_at: string;
}

export type CreateMessageTemplatePayload = {
    name: string;
    channels: Channel[];
    email_subject?: string;
    email_content?: string;
    sms_content?: string;
    sender_profile_uuid?: string | null;
    booking_page_uuid?: string | null;
    append_booking_cta?: boolean;
    /** Organisation tag uuids. On update this replaces the full set (empty array clears). */
    tag_uuids?: string[];
    language?: string;
};

export type UpdateMessageTemplatePayload = Partial<CreateMessageTemplatePayload>;

export type CreateTemplateFromSourcePayload = {
    name?: string;
};

export type GenerateTemplateMessagePayload = {
    channel: Channel;
    action: string;
    prompt?: string;
    language?: string;
    current_subject?: string;
    current_content?: string;
};

export type GenerateTemplateMessageResult = {
    subject: string | null;
    content: string;
};
