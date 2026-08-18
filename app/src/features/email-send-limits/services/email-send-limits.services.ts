import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    EmailSendLimitStatus,
    UpsertEmailSendLimitPayload,
} from "../interfaces/email-send-limits.interfaces";

export const listEmailSendLimits = async (): Promise<EmailSendLimitStatus[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.email_send_limits.list);
        return response.data;
    } catch {
        throw new Error("Failed to load email send limits. Please try again.");
    }
};

export const upsertEmailSendLimit = async (
    payload: UpsertEmailSendLimitPayload,
): Promise<EmailSendLimitStatus> => {
    try {
        const response = await axiosInstance.put(ApiRoutes.email_send_limits.upsert, payload);
        return response.data;
    } catch {
        throw new Error("Failed to save email send limit. Please try again.");
    }
};

export const deleteEmailSendLimit = async (uuid: string): Promise<{ deleted: true }> => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.email_send_limits.remove(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to remove email send limit. Please try again.");
    }
};
