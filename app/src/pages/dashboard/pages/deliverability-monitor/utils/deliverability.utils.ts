import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import type {
    DeliverabilityActionMode,
    DeliverabilityActionTaken,
    DeliverabilityCheckType,
    DeliverabilityFrequency,
    DeliverabilityRiskLevel,
    DeliverabilitySchedule,
} from "@/features/deliverability/interfaces/deliverability.interface";

export type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

export interface Option<T extends string = string> {
    id: T;
    label: string;
}

export const FREQUENCY_OPTIONS: Option<DeliverabilityFrequency>[] = [
    { id: "DAILY", label: "Every day" },
    { id: "WEEKLY", label: "Every week" },
    { id: "EVERY_N_DAYS", label: "Every N days" },
    { id: "MONTHLY", label: "Every month" },
];

export const WEEKDAY_OPTIONS: Option[] = [
    { id: "1", label: "Monday" },
    { id: "2", label: "Tuesday" },
    { id: "3", label: "Wednesday" },
    { id: "4", label: "Thursday" },
    { id: "5", label: "Friday" },
    { id: "6", label: "Saturday" },
    { id: "7", label: "Sunday" },
];

export const ACTION_MODE_OPTIONS: (Option<DeliverabilityActionMode> & { description: string })[] = [
    {
        id: "RECOMMEND",
        label: "Recommend only",
        description: "Show the score and a suggested daily send cap. You apply it with one click.",
    },
    {
        id: "THROTTLE",
        label: "Auto-throttle",
        description: "Cap daily sending while the score is low, and lift the cap when it recovers.",
    },
    {
        id: "PAUSE",
        label: "Auto-pause",
        description: "Throttle, and stop sending from this sender entirely below the critical score.",
    },
];

export const CHECK_OPTIONS: (Option<DeliverabilityCheckType> & { description: string })[] = [
    {
        id: "DNS",
        label: "DNS & blacklist",
        description: "SPF, DKIM, DMARC, MX and blacklist lookups (MxToolbox).",
    },
    {
        id: "MAIL_TESTER",
        label: "Spam test",
        description: "Sends a real test email and reads the spam score (Mail-Tester).",
    },
];

export const DEFAULT_CHECKS: DeliverabilityCheckType[] = ["DNS", "MAIL_TESTER"];

export const DAY_OF_MONTH_OPTIONS: Option[] = Array.from({ length: 28 }, (_, i) => ({
    id: String(i + 1),
    label: String(i + 1),
}));

const BASE_TIMEZONE_OPTIONS: Option[] = TimezoneOptions.map((o) => ({
    id: o.value,
    label: o.label,
}));

/** The shared timezone list, plus `current` when a saved schedule uses a zone outside it. */
export function timezoneOptionsFor(current: string): Option[] {
    return BASE_TIMEZONE_OPTIONS.some((o) => o.id === current)
        ? BASE_TIMEZONE_OPTIONS
        : [{ id: current, label: current }, ...BASE_TIMEZONE_OPTIONS];
}

const ordinal = (n: number): string => {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
};

export function describeCadence(schedule: DeliverabilitySchedule): string {
    const at = `${schedule.time_of_day} (${schedule.timezone})`;
    switch (schedule.frequency) {
        case "DAILY":
            return `Every day at ${at}`;
        case "WEEKLY": {
            const day = WEEKDAY_OPTIONS.find((o) => o.id === String(schedule.weekday))?.label;
            return `Every ${day ?? "week"} at ${at}`;
        }
        case "EVERY_N_DAYS":
            return `Every ${schedule.interval_days} days at ${at}`;
        case "MONTHLY":
            return `Monthly on the ${ordinal(schedule.day_of_month ?? 1)} at ${at}`;
    }
}

export const RISK_COLOR: Record<DeliverabilityRiskLevel, ChipColor> = {
    LOW: "success",
    MEDIUM: "warning",
    HIGH: "danger",
    CRITICAL: "danger",
};

export const RISK_LABEL: Record<DeliverabilityRiskLevel, string> = {
    LOW: "Healthy",
    MEDIUM: "At risk",
    HIGH: "High risk",
    CRITICAL: "Critical",
};

export const ACTION_TAKEN_LABEL: Record<DeliverabilityActionTaken, string> = {
    NONE: "No action needed",
    RECOMMENDED: "Cap recommended",
    THROTTLED: "Sending throttled",
    PAUSED: "Sending paused",
    LIFTED: "Restriction lifted",
    APPLIED: "Recommended cap applied",
};

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}
