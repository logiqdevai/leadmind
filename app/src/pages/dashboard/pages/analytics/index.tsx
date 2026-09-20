import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { useSearchParams } from "react-router-dom";
import { BarChart2, List, Megaphone, X } from "lucide-react";
import { useContactList, useContactLists } from "@/features/contact-lists/hooks/use-contact-lists";
import { useCampaign, useCampaigns } from "@/features/marketing-campaigns/hooks/use-marketing-campaigns";
import type { ContactAudienceScope } from "@/features/contact-audience-stats/interfaces/contact-audience-stats.interface";
import { ContactAudienceAnalyticsPanel } from "@/pages/dashboard/components/audience-analytics/contact-audience-analytics-panel";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { SearchableSelect, type SearchableSelectOption } from "./components/searchable-select";

type Source = "list" | "campaign";

const ALL_SUBLISTS = "__all__";

export default function AnalyticsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const source: Source = searchParams.get("source") === "campaign" ? "campaign" : "list";
    const listUuid = searchParams.get("list");
    const sublistUuid = searchParams.get("sublist");
    const campaignUuid = searchParams.get("campaign");

    const updateParams = (next: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") params.delete(k);
            else params.set(k, v);
        }
        setSearchParams(params, { replace: true });
    };

    const [listSearch, setListSearch] = useState("");
    const [sublistSearch, setSublistSearch] = useState("");
    const [campaignSearch, setCampaignSearch] = useState("");
    const debouncedListSearch = useDebouncedValue(listSearch, 300).trim();
    const debouncedSublistSearch = useDebouncedValue(sublistSearch, 300).trim();
    const debouncedCampaignSearch = useDebouncedValue(campaignSearch, 300).trim();

    // Root lists and sublists are fetched separately: one "all lists" page gets crowded out by sublists.
    const { data: listsPage, isLoading: listsLoading } = useContactLists(
        { root_only: true, limit: 100, search: debouncedListSearch || undefined },
        source === "list",
    );
    const { data: sublistsPage } = useContactLists(
        { parent_list_uuid: listUuid ?? undefined, limit: 100, search: debouncedSublistSearch || undefined },
        source === "list" && !!listUuid,
    );
    const { data: selectedList } = useContactList(source === "list" ? (listUuid ?? "") : "");
    const { data: selectedSublist } = useContactList(source === "list" ? (sublistUuid ?? "") : "");
    const { data: campaignsPage, isLoading: campaignsLoading } = useCampaigns({
        limit: 100,
        search: debouncedCampaignSearch || undefined,
    });
    const { data: campaign } = useCampaign(source === "campaign" ? campaignUuid : null);

    const listOptions = useMemo<SearchableSelectOption[]>(
        () =>
            (listsPage?.data ?? []).map((l) => ({
                id: l.uuid,
                label: l.title,
                description: l.child_count ? `${l.child_count} sublist${l.child_count === 1 ? "" : "s"}` : undefined,
            })),
        [listsPage],
    );

    const hasSublists = (selectedList?.child_count ?? 0) > 0;
    const sublistOptions = useMemo<SearchableSelectOption[]>(
        () => [
            { id: ALL_SUBLISTS, label: "All sublists (combined)" },
            ...(sublistsPage?.data ?? []).map((l) => ({
                id: l.uuid,
                label: l.title,
                description: l.child_count
                    ? `Includes ${l.child_count} nested sublist${l.child_count === 1 ? "" : "s"}`
                    : undefined,
            })),
        ],
        [sublistsPage],
    );

    const campaignOptions = useMemo<SearchableSelectOption[]>(
        () =>
            (campaignsPage?.data ?? []).map((c) => ({
                id: c.uuid,
                label: c.name,
                description: `${c.status.toLowerCase()} · ${c.selected_contact_count.toLocaleString()} recipients`,
            })),
        [campaignsPage],
    );

    // With nothing selected, the whole CRM is analysed.
    const scope: ContactAudienceScope =
        source === "campaign"
            ? campaignUuid
                ? { type: "campaign", uuid: campaignUuid }
                : { type: "organisation" }
            : listUuid
              ? { type: "list", uuid: sublistUuid ?? listUuid }
              : { type: "organisation" };

    const hasSelection = scope.type !== "organisation";
    const clearSelection = () => updateParams({ list: null, sublist: null, campaign: null });

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
                <BarChart2 className="size-5 text-muted" />
                <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex w-fit rounded-lg border border-border/60 bg-surface-secondary/50 p-0.5">
                        {(
                            [
                                { id: "list", label: "List", icon: List },
                                { id: "campaign", label: "Campaign", icon: Megaphone },
                            ] as const
                        ).map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => updateParams({ source: id === "list" ? null : id })}
                                aria-pressed={source === id}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                                    source === id
                                        ? "bg-surface text-foreground shadow-sm font-medium"
                                        : "text-muted hover:text-foreground",
                                )}
                            >
                                <Icon className="size-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                    {hasSelection ? (
                        <Button size="sm" variant="tertiary" onPress={clearSelection}>
                            <X className="size-4" />
                            All contacts
                        </Button>
                    ) : (
                        <span className="text-xs text-muted">
                            Showing every contact in your CRM. Pick a list or campaign to narrow it down.
                        </span>
                    )}
                </div>

                {source === "list" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <SearchableSelect
                            label="List"
                            value={listUuid}
                            options={listOptions}
                            onChange={(id) => updateParams({ list: id, sublist: null })}
                            placeholder="Select a list"
                            searchPlaceholder="Search lists…"
                            isLoading={listsLoading && !debouncedListSearch}
                            selectedLabel={selectedList?.title}
                            onSearchChange={setListSearch}
                        />
                        {listUuid && hasSublists ? (
                            <SearchableSelect
                                label="Sublist (optional)"
                                value={sublistUuid ?? ALL_SUBLISTS}
                                options={sublistOptions}
                                onChange={(id) => updateParams({ sublist: id === ALL_SUBLISTS ? null : id })}
                                placeholder="All sublists (combined)"
                                searchPlaceholder="Search sublists…"
                                selectedLabel={selectedSublist?.title}
                                onSearchChange={setSublistSearch}
                            />
                        ) : null}
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <SearchableSelect
                            label="Campaign"
                            value={campaignUuid}
                            options={campaignOptions}
                            onChange={(id) => updateParams({ campaign: id })}
                            placeholder="Select a campaign"
                            searchPlaceholder="Search campaigns…"
                            isLoading={campaignsLoading && !debouncedCampaignSearch}
                            selectedLabel={campaign?.name}
                            onSearchChange={setCampaignSearch}
                        />
                    </div>
                )}
            </div>

            <ContactAudienceAnalyticsPanel scope={scope} />
        </div>
    );
}
