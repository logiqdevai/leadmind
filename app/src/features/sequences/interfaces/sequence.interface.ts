import type { OrgTagSummary, Paginated, TagFilterQuery } from "@/features/org-tags/interfaces/org-tag.interface";
import { Channel } from "@/features/contacts/interfaces/contact.interface";

export const SequenceStatus = {
    DRAFT: "DRAFT",
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
} as const;
export type SequenceStatus = (typeof SequenceStatus)[keyof typeof SequenceStatus];

export const SequenceDelayUnit = {
    HOURS: "HOURS",
    DAYS: "DAYS",
    WEEKS: "WEEKS",
    MONTHS: "MONTHS",
} as const;
export type SequenceDelayUnit = (typeof SequenceDelayUnit)[keyof typeof SequenceDelayUnit];

export const SequenceDelayReference = {
    FIRST_STEP: "FIRST_STEP",
    PREVIOUS_STEP: "PREVIOUS_STEP",
} as const;
export type SequenceDelayReference =
    (typeof SequenceDelayReference)[keyof typeof SequenceDelayReference];

export const SequenceEnrollmentStatus = {
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
} as const;
export type SequenceEnrollmentStatus =
    (typeof SequenceEnrollmentStatus)[keyof typeof SequenceEnrollmentStatus];

export interface SequenceStep {
    uuid: string;
    sequence_uuid: string;
    order_index: number;
    enabled: boolean;
    channel: Channel;
    email_subject: string | null;
    email_content: string | null;
    sms_content: string | null;
    message_template_uuid: string | null;
    delay_value: number;
    delay_unit: SequenceDelayUnit;
    delay_reference: SequenceDelayReference;
    send_time: string | null;
    created_at: string;
    updated_at: string;
}

export interface OutreachSequence {
    uuid: string;
    organisation_uuid: string;
    name: string;
    description: string | null;
    status: SequenceStatus;
    stop_on_reply: boolean;
    sender_profile_uuid: string | null;
    steps: SequenceStep[];
    tags?: OrgTagSummary[];
    created_at: string;
    updated_at: string;
}

export interface SequenceEnrollment {
    uuid: string;
    sequence_uuid: string;
    contact_uuid: string;
    campaign_uuid: string | null;
    status: SequenceEnrollmentStatus;
    enrolled_at: string;
    cancelled_at: string | null;
    completed_at: string | null;
    contact?: {
        uuid: string;
        name: string | null;
        email: string | null;
        phone: string | null;
    };
}

export interface ContactSequenceEnrollment extends SequenceEnrollment {
    sequence: { uuid: string; name: string };
}

export interface PaginatedSequenceEnrollments {
    data: SequenceEnrollment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export type CreateSequencePayload = {
    name: string;
    description?: string;
    stop_on_reply?: boolean;
    tag_uuids?: string[];
    sender_profile_uuid?: string | null;
};

export type UpdateSequencePayload = Partial<CreateSequencePayload>;

export type CreateSequenceStepPayload = {
    channel: Channel;
    email_subject?: string;
    email_content?: string;
    sms_content?: string;
    message_template_uuid?: string;
    delay_value: number;
    delay_unit: SequenceDelayUnit;
    delay_reference: SequenceDelayReference;
    send_time?: string | null;
    enabled?: boolean;
};

export type UpdateSequenceStepPayload = Partial<CreateSequenceStepPayload>;

export interface ListSequencesQuery extends TagFilterQuery {
    status?: SequenceStatus;
    search?: string;
    page?: number;
    limit?: number;
}

export type PaginatedSequences = Paginated<OutreachSequence>;
