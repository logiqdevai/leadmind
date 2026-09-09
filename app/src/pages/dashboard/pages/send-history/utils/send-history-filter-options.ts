import { useMemo } from "react";
import { Channel, MsgStatus } from "@/features/contacts/interfaces/contact.interface";
import { SendSource, EmailIntegrationProvider } from "@/features/outreach/interfaces/send-history.interface";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { listSendableEmailAccounts } from "@/features/integrations/utils/email-provider-utils";
import { useCampaigns } from "@/features/marketing-campaigns/hooks/use-marketing-campaigns";
import { useSequences } from "@/features/sequences/hooks/use-sequences";
import {
    useCurrentOrganisation,
    useOrganisationMembers,
} from "@/features/organisations/hooks/use-organisations";
import type { SendHistoryFilterOption } from "../components/send-history-filters-form";

export const CHANNEL_OPTIONS: SendHistoryFilterOption[] = [
    { id: "", label: "All channels" },
    { id: Channel.EMAIL, label: "Email" },
    { id: Channel.SMS, label: "SMS" },
];

export const SOURCE_OPTIONS: SendHistoryFilterOption[] = [
    { id: "", label: "All sources" },
    { id: SendSource.DIRECT, label: "Direct contact" },
    { id: SendSource.CAMPAIGN, label: "Campaign" },
    { id: SendSource.SEQUENCE, label: "Sequence" },
];

export const STATUS_OPTIONS: SendHistoryFilterOption[] = [
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

export const PROVIDER_OPTIONS: SendHistoryFilterOption[] = [
    { id: "", label: "All integrations" },
    { id: EmailIntegrationProvider.RESEND, label: "Resend" },
    { id: EmailIntegrationProvider.SMTP, label: "SMTP" },
];

/**
 * Shared option-list data (campaigns/sequences/org members/email accounts) behind the send-history
 * filter fields - used by both the table's inline filters bar and the inbox's filters modal so
 * they stay in sync without each re-fetching/re-deriving the same lists.
 */
export function useSendHistoryFilterOptions() {
    const { data: currentOrg } = useCurrentOrganisation();
    const { data: members } = useOrganisationMembers(currentOrg?.uuid ?? "");
    const { data: integrations } = useIntegrations();
    const { data: campaignsData } = useCampaigns({ limit: 100 });
    const { data: sequencesData } = useSequences();

    const emailAccounts = useMemo(() => listSendableEmailAccounts(integrations), [integrations]);

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

    return { emailAccounts, campaignOptions, sequenceOptions, userOptions };
}
