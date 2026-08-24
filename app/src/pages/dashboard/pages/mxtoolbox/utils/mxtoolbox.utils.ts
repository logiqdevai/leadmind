import type { MxToolboxCheck } from "@/features/mxtoolbox/interfaces/mxtoolbox.interface";

export function formatMxToolboxDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export type MxToolboxChipColor = "default" | "accent" | "success" | "warning" | "danger";

export const MXTOOLBOX_STATUS_COLOR: Record<MxToolboxCheck["status"], MxToolboxChipColor> = {
    PASSED: "success",
    WARNING: "warning",
    FAILED: "danger",
};

export function severityColor(
    severity: "high" | "medium" | "low" | undefined,
): MxToolboxChipColor {
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
