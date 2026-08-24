import type { SendHistoryMessage } from "@/features/outreach/interfaces/send-history.interface";
import type { IntegrationProviderView } from "@/features/integrations/interfaces/integrations.interface";

export function formatSendHistoryDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function resolveAccountTitle(
    integrations: IntegrationProviderView[] | undefined,
    provider: "RESEND" | "SMTP",
    account: string,
): string {
    const integration = integrations?.find((row) => row.provider === provider);
    return (
        integration?.accounts?.find((row) => row.account === account)?.title ??
        account
    );
}

export function getSendIntegrationLabel(
    message: SendHistoryMessage,
    integrations?: IntegrationProviderView[],
): string {
    if (message.channel === "SMS") {
        return message.sms_provider === "TWILIO" ? "Twilio" : "—";
    }

    if (message.email_provider === "SMTP") {
        if (!message.email_account) return "SMTP";
        const title = resolveAccountTitle(
            integrations,
            "SMTP",
            message.email_account,
        );
        return `SMTP · ${title}`;
    }

    if (message.email_provider === "RESEND") {
        if (message.email_account === "env") return "Resend (env)";
        if (!message.email_account) return "Resend";
        const title = resolveAccountTitle(
            integrations,
            "RESEND",
            message.email_account,
        );
        return `Resend · ${title}`;
    }

    return "—";
}

export function getSendSourceLabel(message: SendHistoryMessage): string {
    if (message.sequence_enrollment) {
        const step = message.sequence_step
            ? ` · Step ${message.sequence_step.order_index + 1}`
            : "";
        return `Sequence · ${message.sequence_enrollment.sequence.name}${step}`;
    }
    if (message.campaign) {
        return `Campaign · ${message.campaign.name}`;
    }
    return "Direct";
}

export function getContactDestination(message: SendHistoryMessage): string {
    if (message.channel === "EMAIL") {
        return message.contact.email ?? "—";
    }
    if (message.channel === "SMS") {
        return message.contact.phone ?? "—";
    }
    return message.contact.email ?? message.contact.phone ?? "—";
}
