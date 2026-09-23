import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { OAuthConnection } from "../interfaces/oauth-connection.interfaces";

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
