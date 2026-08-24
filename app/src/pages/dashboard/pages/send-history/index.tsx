import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { Channel, MsgStatus } from "@/features/contacts/interfaces/contact.interface";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import {
    allocationKey,
    listSendableEmailAccounts,
} from "@/features/integrations/utils/email-provider-utils";
import { useSendHistory } from "@/features/outreach/hooks/use-send-history";
import {
    EmailIntegrationProvider,
    SendSource,
} from "@/features/outreach/interfaces/send-history.interface";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCampaigns } from "@/features/marketing-campaigns/hooks/use-marketing-campaigns";
import { useSequences } from "@/features/sequences/hooks/use-sequences";
import {
    useCurrentOrganisation,
    useOrganisationMembers,
} from "@/features/organisations/hooks/use-organisations";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { ContactsToolbar } from "@/pages/dashboard/pages/contacts/components/contacts-toolbar";
import { SendHistoryTable } from "./components/send-history-table";
import { SendHistoryTableSkeleton } from "./components/send-history-table-skeleton";
import { SendHistoryFiltersBar } from "./components/send-history-filters-bar";

const PAGE_SIZE = 25;

function dateToStartIso(date: string): string {
    return new Date(`${date}T00:00:00`).toISOString();
}

function dateToEndIso(date: string): string {
    return new Date(`${date}T23:59:59.999`).toISOString();
}

const CHANNEL_OPTIONS = [
    { id: "", label: "All channels" },
    { id: Channel.EMAIL, label: "Email" },
    { id: Channel.SMS, label: "SMS" },
];

const SOURCE_OPTIONS = [
    { id: "", label: "All sources" },
    { id: SendSource.DIRECT, label: "Direct contact" },
    { id: SendSource.CAMPAIGN, label: "Campaign" },
    { id: SendSource.SEQUENCE, label: "Sequence" },
];

const STATUS_OPTIONS = [
    { id: "", label: "All statuses" },
    { id: MsgStatus.SENT, label: "Sent" },
    { id: MsgStatus.DELIVERED, label: "Delivered" },
    { id: MsgStatus.OPENED, label: "Opened" },
    { id: MsgStatus.CLICKED, label: "Clicked" },
    { id: MsgStatus.REPLIED, label: "Replied" },
    { id: MsgStatus.FAILED, label: "Failed" },
    { id: MsgStatus.BOUNCED, label: "Bounced" },
    { id: MsgStatus.UNSUBSCRIBED, label: "Unsubscribed" },
    { id: MsgStatus.SKIPPED, label: "Skipped" },
];

const PROVIDER_OPTIONS = [
    { id: "", label: "All integrations" },
    { id: EmailIntegrationProvider.RESEND, label: "Resend" },
    { id: EmailIntegrationProvider.SMTP, label: "SMTP" },
];

export default function SendHistoryPage() {
    const [searchParams, setSearchParams] = useSearchParams();

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

    const { data: currentOrg } = useCurrentOrganisation();
    const { data: members } = useOrganisationMembers(currentOrg?.uuid ?? "");
    const { data: integrations } = useIntegrations();

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
    const { data: campaignsData } = useCampaigns({ limit: 100 });
    const { data: sequencesData } = useSequences();

    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = data?.totalPages ?? 1;

    const emailAccounts = useMemo(
        () => listSendableEmailAccounts(integrations),
        [integrations],
    );

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

    const campaignOptions = useMemo(
        () => [
            { id: "", label: "All campaigns" },
            ...(campaignsData?.data ?? []).map((campaign) => ({
                id: campaign.uuid,
                label: campaign.name,
            })),
        ],
        [campaignsData?.data],
    );

    const sequenceOptions = useMemo(
        () => [
            { id: "", label: "All sequences" },
            ...(sequencesData ?? []).map((sequence) => ({
                id: sequence.uuid,
                label: sequence.name,
            })),
        ],
        [sequencesData],
    );

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
        : `${total} send${total === 1 ? "" : "s"}${isFetching ? " · Updating…" : ""}`;

    return (
        <div className="space-y-4">
            <ContactsToolbar title="Send history" meta={meta} />

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

                    <SendHistoryTable rows={rows} />
                </div>
            )}
        </div>
    );
}
