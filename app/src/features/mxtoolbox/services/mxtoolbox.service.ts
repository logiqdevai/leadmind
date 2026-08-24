import axios from "axios";
import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateMxToolboxCheckPayload,
    MxToolboxCheck,
} from "../interfaces/mxtoolbox.interface";

function apiErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) {
        return fallback;
    }
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (!data?.message) {
        return fallback;
    }
    return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}

export const listMxToolboxChecks = async (): Promise<MxToolboxCheck[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.mxtoolbox.list);
        return response.data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, "Failed to load domain health checks."));
    }
};

export const startMxToolboxCheck = async (
    payload: CreateMxToolboxCheckPayload,
): Promise<MxToolboxCheck> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.mxtoolbox.create, payload);
        return response.data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, "Failed to run domain health check."));
    }
};

export const rerunMxToolboxCheck = async (uuid: string): Promise<MxToolboxCheck> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.mxtoolbox.rerun(uuid), {});
        return response.data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, "Failed to re-run check."));
    }
};

export const runMxToolboxAiAudit = async (uuid: string): Promise<MxToolboxCheck> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.mxtoolbox.ai_audit(uuid), {});
        return response.data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, "Failed to run AI audit."));
    }
};
