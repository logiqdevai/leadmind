import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, TextField } from "@heroui/react";
import { SlidersHorizontal, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInboxContacts } from "@/features/outreach/hooks/use-outreach";
import { Channel, MsgStatus, ThreadOrigin } from "@/features/contacts/interfaces/contact.interface";
import { EmailIntegrationProvider } from "@/features/outreach/interfaces/send-history.interface";
import { allocationKey } from "@/features/integrations/utils/email-provider-utils";
import { dateToEndIso, dateToStartIso } from "../../utils/send-history.utils";
import {
    CHANNEL_OPTIONS,
    PROVIDER_OPTIONS,
    SOURCE_OPTIONS,
    STATUS_OPTIONS,
    useSendHistoryFilterOptions,
} from "../../utils/send-history-filter-options";
import { SendHistoryFiltersModal } from "../send-history-filters-modal";
import { InboxContactList } from "./inbox-contact-list";
import { InboxThreadList } from "./inbox-thread-list";
import { ThreadConversationPanel } from "./thread-conversation-panel";
import { InboxContactDrawer } from "./inbox-contact-drawer";

const PAGE_SIZE = 30;

export function SendHistoryInboxView() {
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedContactUuid = searchParams.get("contact");
    const selectedThreadUuid = searchParams.get("thread");
    const [drawerContactUuid, setDrawerContactUuid] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const page = Math.max(1, Number(searchParams.get("inbox_page") ?? 1));
    const search = searchParams.get("inbox_search") ?? "";
    const channel = searchParams.get("inbox_channel") ?? "";
    const source = searchParams.get("inbox_source") ?? "";
    const status = searchParams.get("inbox_status") ?? "";
    const emailProvider = searchParams.get("inbox_email_provider") ?? "";
    const emailAccount = searchParams.get("inbox_email_account") ?? "";
    const campaignUuid = searchParams.get("inbox_campaign_uuid") ?? "";
    const sequenceUuid = searchParams.get("inbox_sequence_uuid") ?? "";
    const sentByUserUuid = searchParams.get("inbox_sent_by_user_uuid") ?? "";
    const dateFrom = searchParams.get("inbox_date_from") ?? "";
    const dateTo = searchParams.get("inbox_date_to") ?? "";

    const debouncedSearch = useDebouncedValue(search, 300);
    const { emailAccounts, campaignOptions, sequenceOptions, userOptions } =
        useSendHistoryFilterOptions();

    const updateParams = (next: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(next)) {
            if (value == null || value === "") params.delete(key);
            else params.set(key, value);
        }
        setSearchParams(params, { replace: true });
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams);
        for (const key of [
            "inbox_search",
            "inbox_channel",
            "inbox_source",
            "inbox_status",
            "inbox_email_provider",
            "inbox_email_account",
            "inbox_campaign_uuid",
            "inbox_sequence_uuid",
            "inbox_sent_by_user_uuid",
            "inbox_date_from",
            "inbox_date_to",
            "inbox_page",
        ]) {
            params.delete(key);
        }
        setSearchParams(params, { replace: true });
    };

    const hasActiveFilters = Boolean(
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
            search: debouncedSearch || undefined,
            channel: (channel as Channel) || undefined,
            source: (source as ThreadOrigin) || undefined,
            status: (status as MsgStatus) || undefined,
            email_provider: (emailProvider as EmailIntegrationProvider) || undefined,
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

    const { data, isLoading, isFetching } = useInboxContacts(query);

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
            provider: emailProvider as EmailIntegrationProvider,
            account: emailAccount,
        });
        return emailAccountOptions.some((option) => option.id === key) ? key : "";
    }, [emailProvider, emailAccount, emailAccountOptions]);

    const selectContact = (uuid: string | null) => {
        const params = new URLSearchParams(searchParams);
        if (uuid) params.set("contact", uuid);
        else params.delete("contact");
        params.delete("thread");
        setSearchParams(params, { replace: true });
    };

    const selectThread = (uuid: string | null) => {
        const params = new URLSearchParams(searchParams);
        if (uuid) params.set("thread", uuid);
        else params.delete("thread");
        setSearchParams(params, { replace: true });
    };

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border">
            <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                    <TextField name="inbox-search" className="w-full">
                        <Input
                            className="h-8 pl-8 text-[13px]"
                            placeholder="Search contacts…"
                            value={search}
                            onChange={(e) =>
                                updateParams({ inbox_search: e.target.value || null, inbox_page: null })
                            }
                            aria-label="Search contacts"
                        />
                    </TextField>
                </div>
                <Button
                    size="sm"
                    variant={hasActiveFilters ? "primary" : "secondary"}
                    className="h-8 shrink-0 px-2.5 text-[12px]"
                    onPress={() => setFiltersOpen(true)}
                >
                    <SlidersHorizontal className="size-3.5" />
                    Filters
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div
                    className={cn(
                        "w-full flex-col border-border md:w-[19rem] md:shrink-0 md:border-r",
                        selectedContactUuid ? "hidden md:flex" : "flex",
                    )}
                >
                    <InboxContactList
                        rows={data?.data ?? []}
                        total={data?.total ?? 0}
                        totalPages={data?.totalPages ?? 1}
                        page={page}
                        isLoading={isLoading}
                        isFetching={isFetching}
                        selectedContactUuid={selectedContactUuid}
                        onSelectContact={selectContact}
                        onPrevPage={() => updateParams({ inbox_page: String(page - 1) })}
                        onNextPage={() => updateParams({ inbox_page: String(page + 1) })}
                    />
                </div>

                <div
                    className={cn(
                        "w-full flex-col border-border md:w-[21rem] md:shrink-0 md:border-r",
                        selectedContactUuid && !selectedThreadUuid ? "flex" : "hidden md:flex",
                    )}
                >
                    {selectedContactUuid ? (
                        <InboxThreadList
                            contactUuid={selectedContactUuid}
                            selectedThreadUuid={selectedThreadUuid}
                            onSelectThread={selectThread}
                            onBack={() => selectContact(null)}
                            onViewContact={() => setDrawerContactUuid(selectedContactUuid)}
                        />
                    ) : (
                        <EmptyPane message="Select a contact to see their conversations." />
                    )}
                </div>

                <div className={cn("min-w-0 flex-1 flex-col", selectedThreadUuid ? "flex" : "hidden md:flex")}>
                    {selectedThreadUuid && selectedContactUuid ? (
                        <ThreadConversationPanel
                            threadUuid={selectedThreadUuid}
                            contactUuid={selectedContactUuid}
                            onBack={() => selectThread(null)}
                            onViewContact={() => setDrawerContactUuid(selectedContactUuid)}
                        />
                    ) : (
                        <EmptyPane message="Select a conversation to view messages." />
                    )}
                </div>

                <InboxContactDrawer
                    contactUuid={drawerContactUuid}
                    isOpen={drawerContactUuid !== null}
                    onOpenChange={(open) => {
                        if (!open) setDrawerContactUuid(null);
                    }}
                />
            </div>

            <SendHistoryFiltersModal
                isOpen={filtersOpen}
                onOpenChange={setFiltersOpen}
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
                onChannelChange={(value) => updateParams({ inbox_channel: value || null, inbox_page: null })}
                onSourceChange={(value) => updateParams({ inbox_source: value || null, inbox_page: null })}
                onStatusChange={(value) => updateParams({ inbox_status: value || null, inbox_page: null })}
                onEmailProviderChange={(value) =>
                    updateParams({
                        inbox_email_provider: value || null,
                        inbox_email_account: null,
                        inbox_page: null,
                    })
                }
                onEmailAccountChange={(value) => {
                    if (!value) {
                        updateParams({ inbox_email_account: null, inbox_page: null });
                        return;
                    }
                    const match = emailAccounts.find((row) => allocationKey(row) === value);
                    if (!match) {
                        updateParams({ inbox_email_account: null, inbox_page: null });
                        return;
                    }
                    updateParams({
                        inbox_email_provider: match.provider,
                        inbox_email_account: match.account,
                        inbox_page: null,
                    });
                }}
                onCampaignChange={(value) => updateParams({ inbox_campaign_uuid: value || null, inbox_page: null })}
                onSequenceChange={(value) => updateParams({ inbox_sequence_uuid: value || null, inbox_page: null })}
                onSentByUserChange={(value) =>
                    updateParams({ inbox_sent_by_user_uuid: value || null, inbox_page: null })
                }
                onDateFromChange={(value) => updateParams({ inbox_date_from: value || null, inbox_page: null })}
                onDateToChange={(value) => updateParams({ inbox_date_to: value || null, inbox_page: null })}
                onClear={clearFilters}
            />
        </div>
    );
}

function EmptyPane({ message }: { message: string }) {
    return (
        <div className="flex h-full flex-1 items-center justify-center p-6 text-center text-sm text-muted">
            {message}
        </div>
    );
}
