import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ApiKey,
    CreateApiKeyDto,
    CreatedApiKey,
    UpdateApiKeyDto,
} from "../interfaces/api-key.interfaces";

export const listApiKeys = async (): Promise<ApiKey[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.api_keys.list);
        return response.data;
    } catch {
        throw new Error("Failed to load API keys. Please try again.");
    }
};

export const createApiKey = async (dto: CreateApiKeyDto): Promise<CreatedApiKey> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.api_keys.create, dto);
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message || "Failed to create API key. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message);
    }
};

export const updateApiKey = async (uuid: string, dto: UpdateApiKeyDto): Promise<ApiKey> => {
    try {
        const response = await axiosInstance.put(ApiRoutes.api_keys.update(uuid), dto);
        return response.data;
    } catch {
        throw new Error("Failed to update API key. Please try again.");
    }
};

export const revokeApiKey = async (uuid: string): Promise<ApiKey> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.api_keys.revoke(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to revoke API key. Please try again.");
    }
};

export const deleteApiKey = async (uuid: string): Promise<{ uuid: string }> => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.api_keys.remove(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to delete API key. Please try again.");
    }
};
