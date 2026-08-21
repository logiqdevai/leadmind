import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateSendingPolicyPayload,
    SchedulePreviewResult,
    SendingPolicy,
    UpdateSendingPolicyPayload,
    UpsertSendingPolicyStagePayload,
} from "../interfaces/sending-policy.interface";

export const listSendingPolicies = async (): Promise<SendingPolicy[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.sending_policies.list);
        return response.data;
    } catch {
        throw new Error("Failed to load sending policies. Please try again.");
    }
};

export const getSendingPolicy = async (uuid: string): Promise<SendingPolicy> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.sending_policies.get(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to load sending policy. Please try again.");
    }
};

export const createSendingPolicy = async (
    payload: CreateSendingPolicyPayload,
): Promise<SendingPolicy> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.sending_policies.create, payload);
        return response.data;
    } catch {
        throw new Error("Failed to create sending policy. Please try again.");
    }
};

export const updateSendingPolicy = async (
    uuid: string,
    payload: UpdateSendingPolicyPayload,
): Promise<SendingPolicy> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.sending_policies.update(uuid), payload);
        return response.data;
    } catch {
        throw new Error("Failed to update sending policy. Please try again.");
    }
};

export const deleteSendingPolicy = async (uuid: string): Promise<{ deleted: true }> => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.sending_policies.remove(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to delete sending policy. Please try again.");
    }
};

export const addSendingPolicyStage = async (
    uuid: string,
    payload: UpsertSendingPolicyStagePayload,
): Promise<SendingPolicy> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.sending_policies.add_stage(uuid), payload);
        return response.data;
    } catch {
        throw new Error("Failed to add stage. Please try again.");
    }
};

export const updateSendingPolicyStage = async (
    uuid: string,
    stageUuid: string,
    payload: UpsertSendingPolicyStagePayload,
): Promise<SendingPolicy> => {
    try {
        const response = await axiosInstance.patch(
            ApiRoutes.sending_policies.update_stage(uuid, stageUuid),
            payload,
        );
        return response.data;
    } catch {
        throw new Error("Failed to update stage. Please try again.");
    }
};

export const removeSendingPolicyStage = async (
    uuid: string,
    stageUuid: string,
): Promise<SendingPolicy> => {
    try {
        const response = await axiosInstance.delete(
            ApiRoutes.sending_policies.remove_stage(uuid, stageUuid),
        );
        return response.data;
    } catch {
        throw new Error("Failed to remove stage. Please try again.");
    }
};

export const reorderSendingPolicyStages = async (
    uuid: string,
    stage_uuids: string[],
): Promise<SendingPolicy> => {
    try {
        const response = await axiosInstance.put(ApiRoutes.sending_policies.reorder_stages(uuid), {
            stage_uuids,
        });
        return response.data;
    } catch {
        throw new Error("Failed to reorder stages. Please try again.");
    }
};

export const previewSendingPolicy = async (
    uuid: string,
    contact_count: number,
): Promise<SchedulePreviewResult> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.sending_policies.preview(uuid), {
            contact_count,
        });
        return response.data;
    } catch {
        throw new Error("Failed to preview schedule. Please try again.");
    }
};
