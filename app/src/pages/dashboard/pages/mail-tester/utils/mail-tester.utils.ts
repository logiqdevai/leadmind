import type { MailTesterTest } from "@/features/mail-tester/interfaces/mail-tester.interface";

export function formatMailTesterDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export type MailTesterChipColor = "default" | "accent" | "success" | "warning" | "danger";

export const MAIL_TESTER_STATUS_COLOR: Record<MailTesterTest["status"], MailTesterChipColor> = {
    PENDING: "default",
    COMPLETED: "success",
    FAILED: "danger",
};

export function scoreColor(score: number | null | undefined): MailTesterChipColor {
    if (score == null) return "default";
    if (score >= 8) return "success";
    if (score >= 5) return "warning";
    return "danger";
}

export function statusCheckColor(statusClass: string | undefined): MailTesterChipColor {
    // Mail-Tester statusClass values often come combined with an icon class, e.g.
    // "success icon-check" or "warning icon-check" - match on the leading word.
    const normalized = statusClass?.split(" ")[0];
    switch (normalized) {
        case "success":
            return "success";
        case "warning":
            return "warning";
        case "failure":
            return "danger";
        default:
            return "default";
    }
}

export function severityColor(
    severity: "high" | "medium" | "low" | undefined,
): MailTesterChipColor {
    switch (severity) {
        case "high":
            return "danger";
        case "medium":
            return "warning";
        case "low":
            return "default";
        default:
            return "default";
    }
}

export function stripHtml(value: string | null | undefined): string {
    if (!value) return "";
    return value
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}
