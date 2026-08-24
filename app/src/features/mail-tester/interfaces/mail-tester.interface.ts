import type { EmailProviderTarget } from "@/features/integrations/interfaces/integrations.interface";

export const MailTesterTestStatuses = {
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
} as const;

export type MailTesterTestStatus =
    (typeof MailTesterTestStatuses)[keyof typeof MailTesterTestStatuses];

/**
 * Mail-Tester's JSON API doesn't publish a full schema - only the top-level categories and a
 * handful of field names are documented (api/docs/mail_tester_json_api_reference.md). Nested
 * sections are kept loosely typed on purpose.
 */
export interface MailTesterCommonCheck {
    title?: string;
    mark?: number;
    displayedMark?: number | string;
    status?: string;
    statusClass?: "failure" | "warning" | "neutral" | "success" | string;
    description?: string;
    messages?: string;
    [key: string]: unknown;
}

export interface MailTesterRule {
    code?: string;
    score?: number;
    suggestion?: string;
    [key: string]: unknown;
}

export interface MailTesterResult {
    status: boolean;
    title?: string;
    id?: string;
    score?: number;
    comment?: string;
    messageInfo?: {
        subject?: string;
        receptionDate?: string;
        bounceAddress?: string;
        [key: string]: unknown;
    };
    spamAssassin?: {
        rule?: MailTesterRule[];
        [key: string]: unknown;
    };
    signature?: {
        spf?: MailTesterCommonCheck;
        senderId?: MailTesterCommonCheck;
        dkim?: MailTesterCommonCheck;
        rdns?: MailTesterCommonCheck;
        [key: string]: unknown;
    };
    body?: Record<string, unknown>;
    blacklists?: unknown[];
    links?: unknown[];
    [key: string]: unknown;
}

export interface MailTesterTest {
    uuid: string;
    label: string | null;
    test_identifier: string;
    test_address: string;
    from_provider: EmailProviderTarget["provider"];
    from_account: string;
    status: MailTesterTestStatus;
    score: number | null;
    result: MailTesterResult | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateMailTesterTestPayload {
    from: EmailProviderTarget;
    label?: string;
}
