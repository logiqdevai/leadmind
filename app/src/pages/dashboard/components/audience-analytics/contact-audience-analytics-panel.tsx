import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { FileDown } from "lucide-react";
import type { ContactAudienceScope } from "@/features/contact-audience-stats/interfaces/contact-audience-stats.interface";
import { useContactAudienceStats } from "@/features/contact-audience-stats/hooks/use-contact-audience-stats";
import { useContactAudienceAnalyses } from "@/features/contact-audience-stats/hooks/use-contact-audience-analysis";
import { downloadAudienceReportPdf } from "@/features/contact-audience-stats/utils/audience-report-pdf";
import { isAudienceAnalysisContent } from "@/features/contact-audience-stats/utils/audience-analysis.utils";
import { useCampaign } from "@/features/marketing-campaigns/hooks/use-marketing-campaigns";
import type { ListContactsQuery } from "@/features/contacts/interfaces/contact.interface";
import type { ContactFilters } from "@/interfaces/contact-filters.interface";
import { describeContactFilters, hasActiveContactFilters } from "@/lib/contact-filter-params";
import { StatsCards } from "@/pages/dashboard/pages/campaigns/components/stats-cards";
import { CampaignAnalytics } from "@/pages/dashboard/pages/campaigns/components/campaign-analytics";
import {
    dateRangeFromPreset,
    dateRangePresetLabel,
    type DateRangePreset,
} from "@/features/contact-audience-stats/utils/audience-date-presets";
import { AudienceStatsFiltersBar } from "./audience-stats-filters-bar";
import { AudienceStatsSections } from "./audience-stats-sections";
import { AudiencePipelineDistribution } from "./audience-pipeline-distribution";
import { AudienceAiAnalysisSection } from "./audience-ai-analysis-section";
import { AudienceStatusSections } from "./audience-status-sections";

/** Restricts a contacts query to the audience the stats describe. */
type AudienceContactsQuery = Pick<
    ListContactsQuery,
    "contact_list_uuid" | "include_sublists" | "campaign_uuid" | "filter_uuid"
>;

function contactsQueryForScope(scope: ContactAudienceScope): AudienceContactsQuery {
    switch (scope.type) {
        case "list":
            return { contact_list_uuid: scope.uuid, include_sublists: true };
        case "campaign":
            return { campaign_uuid: scope.uuid };
        case "filter":
            return { filter_uuid: scope.uuid };
        default:
            return {};
    }
}

const AUDIENCE_TYPE_LABEL: Record<ContactAudienceScope["type"], string> = {
    list: "List",
    filter: "Filter",
    campaign: "Campaign",
    organisation: "Whole CRM",
};

interface ContactAudienceAnalyticsPanelProps {
    scope: ContactAudienceScope;
    showSourceFilter?: boolean;
    /** Name of the audience, used in the PDF report header. */
    audienceName?: string;
}

export function ContactAudienceAnalyticsPanel({
    scope,
    showSourceFilter = true,
    audienceName,
}: ContactAudienceAnalyticsPanelProps) {
    const [preset, setPreset] = useState<DateRangePreset>("30d");
    const [contactFilters, setContactFilters] = useState<ContactFilters>({});
    const [debouncedFilters, setDebouncedFilters] = useState<ContactFilters>({});

    const debounceRef = useRef<number | null>(null);

    useEffect(() => {
        if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            setDebouncedFilters((prev) => {
                const next = contactFilters;
                if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                return next;
            });
        }, 300);
        return () => {
            if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
        };
    }, [contactFilters]);

    const statsQuery = useMemo(() => {
        const range = dateRangeFromPreset(preset);
        return {
            ...debouncedFilters,
            ...range,
        };
    }, [preset, debouncedFilters]);

    const { data: stats, isLoading, isFetching, error } = useContactAudienceStats(scope, statsQuery);

    const canClearFilters = preset !== "all" || hasActiveContactFilters(contactFilters);
    const clearFilters = () => {
        setPreset("all");
        setContactFilters({});
        setDebouncedFilters({});
    };
    const loading = isLoading || isFetching;

    // Campaigns lead with their send funnel; the CRM stats below describe the same recipients.
    const { data: campaign } = useCampaign(scope.type === "campaign" ? scope.uuid : null);

    // Same query key as the AI section below, so this reuses its cached result.
    const { data: analyses } = useContactAudienceAnalyses(scope);
    const latestAnalysis = analyses?.items.find(
        (item) => item.status === "COMPLETED" && isAudienceAnalysisContent(item.analysis),
    );

    const reportName =
        audienceName ??
        campaign?.name ??
        latestAnalysis?.audience_name ??
        (scope.type === "organisation" ? "All contacts" : "Audience");

    const downloadReport = () => {
        if (!stats) return;
        downloadAudienceReportPdf({
            audienceName: reportName,
            audienceType: AUDIENCE_TYPE_LABEL[scope.type],
            periodLabel: dateRangePresetLabel(preset),
            filterSummary: describeContactFilters(debouncedFilters),
            stats,
            analysis:
                latestAnalysis && isAudienceAnalysisContent(latestAnalysis.analysis)
                    ? { content: latestAnalysis.analysis, createdAt: latestAnalysis.created_at }
                    : null,
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{reportName}</h2>
                <Button
                    size="sm"
                    variant="secondary"
                    onPress={downloadReport}
                    isDisabled={!stats || loading}
                >
                    <FileDown className="size-4" />
                    Download PDF
                </Button>
            </div>

            <AudienceAiAnalysisSection scope={scope} />

            {scope.type === "campaign" && campaign ? (
                <section className="flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-foreground">Send funnel</h2>
                    <StatsCards campaign={campaign} />
                    <CampaignAnalytics campaign={campaign} embedded />
                </section>
            ) : null}

            <AudienceStatsFiltersBar
                preset={preset}
                onPresetChange={setPreset}
                contactFilters={contactFilters}
                onContactFiltersChange={(patch) => setContactFilters((prev) => ({ ...prev, ...patch }))}
                showSourceFilter={showSourceFilter}
                onClearFilters={canClearFilters ? clearFilters : undefined}
            />

            {error ? (
                <p className="rounded-lg border border-danger/40 bg-danger-soft/20 px-4 py-3 text-sm text-danger">
                    {error instanceof Error ? error.message : "Failed to load analytics."}
                </p>
            ) : null}

            <AudiencePipelineDistribution
                byStatus={stats?.pipeline.by_status}
                total={stats?.pipeline.total_contacts ?? 0}
                isLoading={loading}
            />

            <AudienceStatusSections
                key={`${scope.type}:${scope.uuid ?? "all"}`}
                stats={stats}
                isLoading={loading}
                contactFilters={debouncedFilters}
                scopeQuery={contactsQueryForScope(scope)}
            />

            <AudienceStatsSections stats={stats} isLoading={loading} />
        </div>
    );
}
