import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateAccessTokenDto,
    CreatedAccessToken,
    OAuthConnection,
} from "../interfaces/oauth-connection.interfaces";

export const createOAuthAccessToken = async (
    dto: CreateAccessTokenDto,
): Promise<CreatedAccessToken> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.oauth_connections.create_access_token, dto);
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Failed to create access token. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message, { cause: error });
    }
};

export const listOAuthConnections = async (): Promise<OAuthConnection[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.oauth_connections.list);
        return response.data;
    } catch {
        throw new Error("Failed to load connected apps. Please try again.");
    }
};

export const revokeOAuthConnection = async (uuid: string): Promise<OAuthConnection> => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.oauth_connections.revoke(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to revoke access. Please try again.");
    }
};
