import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    AssignCampaignIntegrationPayload,
    CampaignIntegration,
    CampaignIntegrationCapacity,
    UpdateCampaignIntegrationStatusPayload,
} from "../interfaces/campaign-integration.interface";

export const listCampaignIntegrations = async (
    campaignUuid: string,
): Promise<CampaignIntegration[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.campaign_integrations.list(campaignUuid));
        return response.data;
    } catch {
        throw new Error("Failed to load campaign integrations. Please try again.");
    }
};

export const listCampaignIntegrationsForOrganisation = async (
    excludeCampaignUuid?: string,
): Promise<CampaignIntegration[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.campaign_integrations.list_for_organisation, {
            params: excludeCampaignUuid ? { exclude_campaign_uuid: excludeCampaignUuid } : undefined,
        });
        return response.data;
    } catch {
        throw new Error("Failed to load other campaigns' sending integrations. Please try again.");
    }
};

export const assignCampaignIntegration = async (
    campaignUuid: string,
    payload: AssignCampaignIntegrationPayload,
): Promise<CampaignIntegration> => {
    try {
        const response = await axiosInstance.post(
            ApiRoutes.campaign_integrations.assign(campaignUuid),
            payload,
        );
        return response.data;
    } catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message;
        throw new Error(message || "Failed to assign integration. Please try again.");
    }
};

export const updateCampaignIntegrationStatus = async (
    campaignUuid: string,
    ciUuid: string,
    payload: UpdateCampaignIntegrationStatusPayload,
): Promise<CampaignIntegration> => {
    try {
        const response = await axiosInstance.patch(
            ApiRoutes.campaign_integrations.update_status(campaignUuid, ciUuid),
            payload,
        );
        return response.data;
    } catch {
        throw new Error("Failed to update integration status. Please try again.");
    }
};

export const removeCampaignIntegration = async (
    campaignUuid: string,
    ciUuid: string,
): Promise<{ removed: true }> => {
    try {
        const response = await axiosInstance.delete(
            ApiRoutes.campaign_integrations.remove(campaignUuid, ciUuid),
        );
        return response.data;
    } catch {
        throw new Error("Failed to remove integration. Please try again.");
    }
};

export const getCampaignIntegrationCapacity = async (
    campaignUuid: string,
    ciUuid: string,
): Promise<CampaignIntegrationCapacity> => {
    try {
        const response = await axiosInstance.get(
            ApiRoutes.campaign_integrations.capacity(campaignUuid, ciUuid),
        );
        return response.data;
    } catch {
        throw new Error("Failed to load capacity. Please try again.");
    }
};
