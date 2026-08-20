import { tabTriggerClassName } from "@/components/ui/scrollable-tabs";

export const USAGE_PAGE_LIMIT = 20;

export type UsageTabId = "ai" | "apify";

export const USAGE_TABS: { id: UsageTabId; label: string }[] = [
    { id: "ai", label: "AI" },
    { id: "apify", label: "Apify" },
];

export const USAGE_TAB_PARAM = "tab";

export const USAGE_TAB_CLASS = `${tabTriggerClassName} inline-flex items-center gap-1.5`;
