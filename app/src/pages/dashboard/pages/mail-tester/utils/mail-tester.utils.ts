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
    switch (statusClass) {
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
