import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type {
    AssignCampaignIntegrationPayload,
    UpdateCampaignIntegrationStatusPayload,
} from "../interfaces/campaign-integration.interface";
import {
    assignCampaignIntegration,
    getCampaignIntegrationCapacity,
    getCampaignIntegrationsActivity,
    listCampaignIntegrations,
    listCampaignIntegrationsForOrganisation,
    removeCampaignIntegration,
    updateCampaignIntegrationStatus,
} from "../services/campaign-integrations.service";

export const campaignIntegrationsQueryKeys = {
    all: (campaignUuid: string) => ["campaign-integrations", campaignUuid] as const,
    list: (campaignUuid: string) => ["campaign-integrations", campaignUuid, "list"] as const,
    capacity: (campaignUuid: string, ciUuid: string) =>
        ["campaign-integrations", campaignUuid, "capacity", ciUuid] as const,
    activity: (campaignUuid: string) => ["campaign-integrations", campaignUuid, "activity"] as const,
    forOrganisation: (excludeCampaignUuid?: string) =>
        ["campaign-integrations", "org", excludeCampaignUuid ?? "all"] as const,
};

export function useCampaignIntegrations(campaignUuid: string) {
    return useQuery({
        queryKey: campaignIntegrationsQueryKeys.list(campaignUuid),
        queryFn: () => listCampaignIntegrations(campaignUuid),
        enabled: Boolean(campaignUuid),
    });
}

/** Sending integrations assigned across other campaigns in the org - for "copy from campaign". */
export function useCampaignIntegrationsForOrganisation(excludeCampaignUuid?: string) {
    return useQuery({
        queryKey: campaignIntegrationsQueryKeys.forOrganisation(excludeCampaignUuid),
        queryFn: () => listCampaignIntegrationsForOrganisation(excludeCampaignUuid),
    });
}

export function useCampaignIntegrationCapacity(campaignUuid: string, ciUuid: string | null) {
    return useQuery({
        queryKey: campaignIntegrationsQueryKeys.capacity(campaignUuid, ciUuid ?? ""),
        queryFn: () => getCampaignIntegrationCapacity(campaignUuid, ciUuid as string),
        enabled: Boolean(campaignUuid) && Boolean(ciUuid),
        refetchInterval: 30_000,
    });
}

export function useCampaignIntegrationsActivity(campaignUuid: string) {
    return useQuery({
        queryKey: campaignIntegrationsQueryKeys.activity(campaignUuid),
        queryFn: () => getCampaignIntegrationsActivity(campaignUuid),
        enabled: Boolean(campaignUuid),
        refetchInterval: 60_000,
    });
}

export function useAssignCampaignIntegration(campaignUuid: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: AssignCampaignIntegrationPayload) =>
            assignCampaignIntegration(campaignUuid, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: campaignIntegrationsQueryKeys.all(campaignUuid) });
            toast({ title: "Sending integration assigned", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({ title: "Could not assign integration", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useUpdateCampaignIntegrationStatus(campaignUuid: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { ciUuid: string; payload: UpdateCampaignIntegrationStatusPayload }) =>
            updateCampaignIntegrationStatus(campaignUuid, vars.ciUuid, vars.payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: campaignIntegrationsQueryKeys.all(campaignUuid) });
        },
        onError: (error: Error) => {
            toast({ title: "Could not update integration", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useRemoveCampaignIntegration(campaignUuid: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ciUuid: string) => removeCampaignIntegration(campaignUuid, ciUuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: campaignIntegrationsQueryKeys.all(campaignUuid) });
            toast({ title: "Integration removed", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({ title: "Could not remove integration", description: error.message, variant: "error", duration: 4000 });
        },
    });
}
