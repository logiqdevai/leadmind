import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Checkbox, Tabs } from "@heroui/react";
import { Inbox, LayoutList, RefreshCcw } from "lucide-react";
import { ScrollableTabs, ScrollableTabsList, tabTriggerClassName } from "@/components/ui/scrollable-tabs";
import { Channel, MsgStatus } from "@/features/contacts/interfaces/contact.interface";
import { SequenceEnrollmentStatus } from "@/features/sequences/interfaces/sequence.interface";
import {
    allocationKey,
} from "@/features/integrations/utils/email-provider-utils";
import { useSendHistory } from "@/features/outreach/hooks/use-send-history";
import { useBulkResendOutreachMessages } from "@/features/outreach/hooks/use-outreach";
import { EmailIntegrationProvider, SendSource } from "@/features/outreach/interfaces/send-history.interface";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { ContactsToolbar } from "@/pages/dashboard/pages/contacts/components/contacts-toolbar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SendHistoryTable } from "./components/send-history-table";
import { SendHistoryTableSkeleton } from "./components/send-history-table-skeleton";
import { SendHistoryFiltersBar } from "./components/send-history-filters-bar";
import { SendHistoryInboxView } from "./components/inbox/send-history-inbox-view";
import { dateToEndIso, dateToStartIso, sortSendHistoryByDateDesc } from "./utils/send-history.utils";
import {
    CHANNEL_OPTIONS,
    PROVIDER_OPTIONS,
    SOURCE_OPTIONS,
    STATUS_OPTIONS,
    useSendHistoryFilterOptions,
} from "./utils/send-history-filter-options";

const PAGE_SIZE = 25;

const VIEW_STORAGE_KEY = "send-history.view";

type View = "table" | "inbox";

const isView = (value: string | null): value is View => value === "table" || value === "inbox";

export default function SendHistoryPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [view, setView] = useState<View>(() => {
        if (typeof window === "undefined") return "table";
        const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
        return isView(stored) ? stored : "table";
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    }, [view]);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const search = searchParams.get("search") ?? "";
    const channel = searchParams.get("channel") ?? "";
    const source = searchParams.get("source") ?? "";
    const status = searchParams.get("status") ?? "";
    const emailProvider = searchParams.get("email_provider") ?? "";
    const emailAccount = searchParams.get("email_account") ?? "";
    const campaignUuid = searchParams.get("campaign_uuid") ?? "";
    const sequenceUuid = searchParams.get("sequence_uuid") ?? "";
    const sentByUserUuid = searchParams.get("sent_by_user_uuid") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";

    const debouncedSearch = useDebouncedValue(search, 300);

    useDashboardNavbarTitle("Send history");

    const { emailAccounts, campaignOptions, sequenceOptions, userOptions } =
        useSendHistoryFilterOptions();

    const [selected, setSelected] = useState<Set<string>>(new Set());

    const updateParams = (next: Record<string, string | undefined | null>) => {
        const params = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") params.delete(k);
            else params.set(k, v);
        }
        setSearchParams(params, { replace: true });
        setSelected((prev) => (prev.size === 0 ? prev : new Set()));
    };

    const clearFilters = () => {
        setSearchParams(new URLSearchParams({ page: "1" }), { replace: true });
        setSelected((prev) => (prev.size === 0 ? prev : new Set()));
    };

    const hasActiveFilters = Boolean(
        search ||
            channel ||
            source ||
            status ||
            emailProvider ||
            emailAccount ||
            campaignUuid ||
            sequenceUuid ||
            sentByUserUuid ||
            dateFrom ||
            dateTo,
    );

    const query = useMemo(
        () => ({
            page,
            limit: PAGE_SIZE,
            history_only: true,
            search: debouncedSearch || undefined,
            channel: (channel as typeof Channel.EMAIL) || undefined,
            source: (source as typeof SendSource.DIRECT) || undefined,
            status: (status as typeof MsgStatus.SENT) || undefined,
            email_provider:
                (emailProvider as typeof EmailIntegrationProvider.RESEND) || undefined,
            email_account: emailAccount || undefined,
            campaign_uuid: campaignUuid || undefined,
            sequence_uuid: sequenceUuid || undefined,
            sent_by_user_uuid: sentByUserUuid || undefined,
            date_from: dateFrom ? dateToStartIso(dateFrom) : undefined,
            date_to: dateTo ? dateToEndIso(dateTo) : undefined,
        }),
        [
            page,
            debouncedSearch,
            channel,
            source,
            status,
            emailProvider,
            emailAccount,
            campaignUuid,
            sequenceUuid,
            sentByUserUuid,
            dateFrom,
            dateTo,
        ],
    );

    const { data, isLoading, isFetching } = useSendHistory(query);

    const rows = useMemo(
        () => sortSendHistoryByDateDesc(data?.data ?? []),
        [data?.data],
    );
    const total = data?.total ?? 0;
    const totalPages = data?.totalPages ?? 1;

    const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
    const [restartSequences, setRestartSequences] = useState(false);
    const bulkResendMut = useBulkResendOutreachMessages();

    const selectedCancelledSequenceCount = useMemo(
        () =>
            rows.filter(
                (r) =>
                    selected.has(r.uuid) &&
                    r.sequence_enrollment?.status === SequenceEnrollmentStatus.CANCELLED,
            ).length,
        [rows, selected],
    );

    const toggleSelect = (uuid: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(uuid)) next.delete(uuid);
            else next.add(uuid);
            return next;
        });
    };

    const toggleAll = (uuids: string[], select: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const uuid of uuids) {
                if (select) next.add(uuid);
                else next.delete(uuid);
            }
            return next;
        });
    };

    const handleConfirmResend = async () => {
        const contactUuids = rows.filter((r) => selected.has(r.uuid)).map((r) => r.contact.uuid);
        await bulkResendMut.mutateAsync({
            uuids: [...selected],
            contact_uuids: contactUuids,
            restart_sequence: restartSequences,
        });
        setSelected(new Set());
        setResendConfirmOpen(false);
        setRestartSequences(false);
    };

    const emailAccountOptions = useMemo(() => {
        const filtered = emailProvider
            ? emailAccounts.filter((row) => row.provider === emailProvider)
            : emailAccounts;
        return [
            { id: "", label: "All emails" },
            ...filtered.map((row) => ({
                id: allocationKey(row),
                label: emailProvider ? row.title : row.label,
            })),
        ];
    }, [emailAccounts, emailProvider]);

    const selectedEmailAccountKey = useMemo(() => {
        if (!emailProvider || !emailAccount) return "";
        const key = allocationKey({
            provider: emailProvider as typeof EmailIntegrationProvider.RESEND,
            account: emailAccount,
        });
        return emailAccountOptions.some((option) => option.id === key) ? key : "";
    }, [emailProvider, emailAccount, emailAccountOptions]);

    const meta = isLoading
        ? undefined
        : `${total} send${total === 1 ? "" : "s"}${isFetching ? " · Updating…" : ""}`;

    return (
        <div className="flex h-full min-h-0 flex-col gap-2">
            <ContactsToolbar
                title="Send history"
                meta={view === "table" ? meta : undefined}
                actions={
                    <ScrollableTabs selectedKey={view} onSelectionChange={(key) => setView(String(key) as View)}>
                        <ScrollableTabsList>
                            <Tabs.Tab id="table" className={`${tabTriggerClassName} inline-flex items-center gap-1.5`}>
                                <LayoutList className="size-3.5" />
                                <span className="hidden sm:inline">Table</span>
                            </Tabs.Tab>
                            <Tabs.Tab id="inbox" className={`${tabTriggerClassName} inline-flex items-center gap-1.5`}>
                                <Inbox className="size-3.5" />
                                <span className="hidden sm:inline">Inbox</span>
                            </Tabs.Tab>
                        </ScrollableTabsList>
                    </ScrollableTabs>
                }
            />

            {view === "inbox" ? (
                <div className="-mt-4 min-h-0 flex-1 lg:-mt-6">
                    <SendHistoryInboxView />
                </div>
            ) : null}

            {view === "table" ? (
                <>
            <SendHistoryFiltersBar
                search={search}
                channel={channel}
                source={source}
                status={status}
                emailProvider={emailProvider}
                emailAccount={selectedEmailAccountKey}
                campaignUuid={campaignUuid}
                sequenceUuid={sequenceUuid}
                sentByUserUuid={sentByUserUuid}
                dateFrom={dateFrom}
                dateTo={dateTo}
                channelOptions={CHANNEL_OPTIONS}
                sourceOptions={SOURCE_OPTIONS}
                statusOptions={STATUS_OPTIONS}
                providerOptions={PROVIDER_OPTIONS}
                emailAccountOptions={emailAccountOptions}
                campaignOptions={campaignOptions}
                sequenceOptions={sequenceOptions}
                userOptions={userOptions}
                hasActiveFilters={hasActiveFilters}
                onSearchChange={(value) => updateParams({ search: value || null, page: "1" })}
                onChannelChange={(value) => updateParams({ channel: value || null, page: "1" })}
                onSourceChange={(value) => updateParams({ source: value || null, page: "1" })}
                onStatusChange={(value) => updateParams({ status: value || null, page: "1" })}
                onEmailProviderChange={(value) =>
                    updateParams({
                        email_provider: value || null,
                        email_account: null,
                        page: "1",
                    })
                }
                onEmailAccountChange={(value) => {
                    if (!value) {
                        updateParams({ email_account: null, page: "1" });
                        return;
                    }
                    const match = emailAccounts.find((row) => allocationKey(row) === value);
                    if (!match) {
                        updateParams({ email_account: null, page: "1" });
                        return;
                    }
                    updateParams({
                        email_provider: match.provider,
                        email_account: match.account,
                        page: "1",
                    });
                }}
                onCampaignChange={(value) =>
                    updateParams({ campaign_uuid: value || null, page: "1" })
                }
                onSequenceChange={(value) =>
                    updateParams({ sequence_uuid: value || null, page: "1" })
                }
                onSentByUserChange={(value) =>
                    updateParams({ sent_by_user_uuid: value || null, page: "1" })
                }
                onDateFromChange={(value) =>
                    updateParams({ date_from: value || null, page: "1" })
                }
                onDateToChange={(value) => updateParams({ date_to: value || null, page: "1" })}
                onClear={clearFilters}
            />

            {isLoading ? (
                <SendHistoryTableSkeleton />
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] text-muted tabular-nums">
                            {total.toLocaleString()} result{total === 1 ? "" : "s"}
                            {isFetching ? " · Updating…" : ""}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2.5 text-[12px]"
                                isDisabled={selected.size === 0}
                                onPress={() => setResendConfirmOpen(true)}
                            >
                                <RefreshCcw className="size-3.5" />
                                Resend selected{selected.size > 0 ? ` (${selected.size})` : ""}
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2.5 text-[12px]"
                                isDisabled={page <= 1}
                                onPress={() => updateParams({ page: String(page - 1) })}
                            >
                                Previous
                            </Button>
                            <span className="min-w-[5.5rem] text-center text-[12px] text-muted tabular-nums">
                                {page} / {Math.max(totalPages, 1)}
                            </span>
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

                    <SendHistoryTable
                        rows={rows}
                        selected={selected}
                        onToggleSelect={toggleSelect}
                        onToggleAll={toggleAll}
                    />
                </div>
            )}
                </>
            ) : null}

            <ConfirmDialog
                isOpen={resendConfirmOpen}
                onOpenChange={(open) => {
                    setResendConfirmOpen(open);
                    if (!open) setRestartSequences(false);
                }}
                title={`Resend ${selected.size} message${selected.size === 1 ? "" : "s"}?`}
                description={
                    <div className="flex flex-col gap-3">
                        <p>This retries delivery for the selected failed message(s).</p>
                        {selectedCancelledSequenceCount > 0 ? (
                            <Checkbox isSelected={restartSequences} onChange={setRestartSequences}>
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <span className="text-sm text-foreground">
                                    Also restart the sequence for {selectedCancelledSequenceCount}{" "}
                                    contact{selectedCancelledSequenceCount === 1 ? "" : "s"} whose
                                    sequence was stopped by this failure
                                </span>
                            </Checkbox>
                        ) : null}
                    </div>
                }
                confirmLabel="Resend"
                isPending={bulkResendMut.isPending}
                onConfirm={handleConfirmResend}
            />
        </div>
    );
}
