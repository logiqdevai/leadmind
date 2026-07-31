import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Label, ListBox, Select, Spinner, TextField } from "@heroui/react";
import { useActivityLogs } from "@/features/activity-logs/hooks/use-activity-logs";
import {
    useCurrentOrganisation,
    useOrganisationMembers,
} from "@/features/organisations/hooks/use-organisations";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { AppDatePicker } from "@/components/ui/date-picker";
import { ContactsToolbar } from "@/pages/dashboard/pages/contacts/components/contacts-toolbar";
import { ActivityLogTable } from "./components/activity-log-table";
import { ACTIVITY_ENTITY_FILTER_OPTIONS } from "./utils/activity-log.utils";

const PAGE_SIZE = 25;

function dateToStartIso(date: string): string {
    return new Date(`${date}T00:00:00`).toISOString();
}

function dateToEndIso(date: string): string {
    return new Date(`${date}T23:59:59.999`).toISOString();
}

export default function SettingsActivityPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const search = searchParams.get("search") ?? "";
    const entityType = searchParams.get("entity_type") ?? "";
    const actorUserUuid = searchParams.get("actor_user_uuid") ?? "";
    const dateFrom = searchParams.get("from") ?? "";
    const dateTo = searchParams.get("to") ?? "";

    const debouncedSearch = useDebouncedValue(search, 300);

    useDashboardNavbarTitle("Activity");

    const { data: currentOrg } = useCurrentOrganisation();
    const { data: members } = useOrganisationMembers(currentOrg?.uuid ?? "");

    const updateParams = (next: Record<string, string | undefined | null>) => {
        const params = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") params.delete(k);
            else params.set(k, v);
        }
        setSearchParams(params, { replace: true });
    };

    const clearFilters = () => {
        setSearchParams(new URLSearchParams({ page: "1" }), { replace: true });
    };

    const hasActiveFilters = Boolean(
        search || entityType || actorUserUuid || dateFrom || dateTo,
    );

    const query = useMemo(
        () => ({
            page,
            limit: PAGE_SIZE,
            search: debouncedSearch || undefined,
            entity_type: entityType || undefined,
            actor_user_uuid: actorUserUuid || undefined,
            from: dateFrom ? dateToStartIso(dateFrom) : undefined,
            to: dateTo ? dateToEndIso(dateTo) : undefined,
        }),
        [page, debouncedSearch, entityType, actorUserUuid, dateFrom, dateTo],
    );

    const { data, isLoading, isFetching } = useActivityLogs(query);
    const rows = data?.data ?? [];
    const totalPages = data?.pagination.total_pages ?? 1;
    const total = data?.pagination.total ?? 0;

    const userOptions = useMemo(
        () => [
            { id: "", label: "All users" },
            ...(members ?? []).map((member) => ({
                id: member.user_uuid,
                label: member.full_name?.trim() || member.email,
            })),
        ],
        [members],
    );

    const meta = isLoading
        ? undefined
        : `${total} event${total === 1 ? "" : "s"}${isFetching ? " · Updating…" : ""}`;

    return (
        <div className="space-y-4">
            <ContactsToolbar title="Activity" meta={meta} />

            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3">
                <TextField name="search" className="min-w-[12rem] flex-1">
                    <Label>Search</Label>
                    <Input
                        type="search"
                        className="h-9"
                        placeholder="Action, user, or entity…"
                        value={search}
                        onChange={(e) => updateParams({ search: e.target.value || null, page: "1" })}
                    />
                </TextField>
                <ActivityFilterSelect
                    label="User"
                    value={actorUserUuid}
                    options={userOptions}
                    className="w-[11rem]"
                    onChange={(next) =>
                        updateParams({ actor_user_uuid: next || null, page: "1" })
                    }
                />
                <ActivityFilterSelect
                    label="Entity"
                    value={entityType}
                    options={ACTIVITY_ENTITY_FILTER_OPTIONS}
                    className="w-[10rem]"
                    onChange={(next) => updateParams({ entity_type: next || null, page: "1" })}
                />
                <AppDatePicker
                    className="w-[11rem]"
                    label="From"
                    value={dateFrom}
                    maxValue={dateTo || undefined}
                    onChange={(next) => updateParams({ from: next || null, page: "1" })}
                />
                <AppDatePicker
                    className="w-[11rem]"
                    label="To"
                    value={dateTo}
                    minValue={dateFrom || undefined}
                    onChange={(next) => updateParams({ to: next || null, page: "1" })}
                />
                {hasActiveFilters ? (
                    <Button size="sm" variant="ghost" onPress={clearFilters}>
                        Clear
                    </Button>
                ) : null}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Spinner size="lg" />
                </div>
            ) : (
                <div className="space-y-3">
                    <ActivityLogTable rows={rows} />
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] text-muted tabular-nums">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2.5 text-[12px]"
                                isDisabled={page <= 1}
                                onPress={() => updateParams({ page: String(page - 1) })}
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2.5 text-[12px]"
                                isDisabled={page >= totalPages}
                                onPress={() => updateParams({ page: String(page + 1) })}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ActivityFilterSelect({
    label,
    value,
    options,
    onChange,
    className,
}: {
    label: string;
    value: string;
    options: { id: string; label: string }[];
    onChange: (value: string) => void;
    className?: string;
}) {
    const selected = options.find((option) => option.id === value) ?? options[0];

    return (
        <Select
            className={className}
            selectedKey={selected?.id}
            onSelectionChange={(key) => onChange(String(key ?? ""))}
        >
            <Label>{label}</Label>
            <Select.Trigger className="h-9 w-full text-sm">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item
                            key={option.id || "all"}
                            id={option.id}
                            textValue={option.label}
                        >
                            {option.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
