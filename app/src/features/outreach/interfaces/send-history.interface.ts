import type {
    Channel,
    MsgStatus,
    ThreadOrigin,
} from "@/features/contacts/interfaces/contact.interface";
import type { SequenceEnrollmentStatus } from "@/features/sequences/interfaces/sequence.interface";

export const SendSource = {
    DIRECT: "direct",
    CAMPAIGN: "campaign",
    SEQUENCE: "sequence",
} as const;

export type SendSource = (typeof SendSource)[keyof typeof SendSource];

export const EmailIntegrationProvider = {
    RESEND: "RESEND",
    SMTP: "SMTP",
} as const;

export type EmailIntegrationProvider =
    (typeof EmailIntegrationProvider)[keyof typeof EmailIntegrationProvider];

export interface SendHistoryContact {
    uuid: string;
    name: string | null;
    email: string | null;
    phone: string | null;
}

export interface SendHistoryCampaign {
    uuid: string;
    name: string;
}

export interface SendHistorySequence {
    uuid: string;
    name: string;
}

export interface SendHistorySequenceEnrollment {
    uuid: string;
    status: SequenceEnrollmentStatus;
    sequence: SendHistorySequence;
}

export interface SendHistorySequenceStep {
    uuid: string;
    order_index: number;
}

export interface SendHistorySentBy {
    uuid: string;
    full_name: string | null;
    email: string;
}

export interface SendHistoryMessage {
    uuid: string;
    organisation_uuid: string;
    contact_uuid: string;
    campaign_uuid: string | null;
    sequence_enrollment_uuid: string | null;
    sequence_step_uuid: string | null;
    thread_uuid: string | null;
    sent_by_user_uuid: string | null;
    /** True on the email that received the contact's latest reply, until someone opens the conversation. */
    has_unread_reply: boolean;
    /** True on the email that received the contact's latest reply while we still owe them an answer. */
    needs_reply: boolean;
    /** True on the latest sent email of a conversation we're now waiting on the contact to answer. */
    needs_follow_up: boolean;
    /** When that email went out - i.e. how long they've been quiet. Null unless `needs_follow_up`. */
    follow_up_since: string | null;
    channel: Channel;
    subject: string | null;
    content: string;
    status: MsgStatus;
    scheduled_at: string | null;
    sent_at: string | null;
    delivered_at: string | null;
    email_provider: EmailIntegrationProvider | null;
    email_account: string | null;
    sms_provider: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    contact: SendHistoryContact;
    campaign: SendHistoryCampaign | null;
    sent_by: SendHistorySentBy | null;
    sequence_enrollment: SendHistorySequenceEnrollment | null;
    sequence_step: SendHistorySequenceStep | null;
}

export interface ListSendHistoryQuery {
    page?: number;
    limit?: number;
    channel?: Channel;
    status?: MsgStatus;
    contact_uuid?: string;
    campaign_uuid?: string;
    sequence_uuid?: string;
    source?: SendSource;
    email_provider?: EmailIntegrationProvider;
    email_account?: string;
    sent_by_user_uuid?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    history_only?: boolean;
    needs_follow_up?: boolean;
}

export interface SendHistoryListResponse {
    data: SendHistoryMessage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface InboxContactSummary {
    contact: SendHistoryContact;
    last_message_at: string | null;
    last_channel: Channel | null;
    thread_count: number;
    origins: ThreadOrigin[];
    last_thread_uuid: string | null;
    needs_reply: boolean;
    needs_follow_up: boolean;
    /** Any of the contact's conversations has a reply nobody has opened yet. */
    has_unread_reply: boolean;
}

export interface ListInboxContactsQuery {
    page?: number;
    limit?: number;
    search?: string;
    channel?: Channel;
    source?: ThreadOrigin;
    status?: MsgStatus;
    email_provider?: EmailIntegrationProvider;
    email_account?: string;
    sent_by_user_uuid?: string;
    campaign_uuid?: string;
    sequence_uuid?: string;
    date_from?: string;
    date_to?: string;
    needs_follow_up?: boolean;
}

export interface InboxContactsListResponse {
    data: InboxContactSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface BulkSendItemResult {
    uuid: string;
    ok: boolean;
    jobId?: string;
    error?: string;
}

export interface BulkSendResult {
    results: BulkSendItemResult[];
    succeeded: number;
    failed: number;
}
