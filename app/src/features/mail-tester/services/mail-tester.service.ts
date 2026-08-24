import axios from "axios";
import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateMailTesterTestPayload,
    MailTesterTest,
} from "../interfaces/mail-tester.interface";

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

export const listMailTesterTests = async (): Promise<MailTesterTest[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.mail_tester.list);
        return response.data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, "Failed to load deliverability tests."));
    }
};

export const startMailTesterTest = async (
    payload: CreateMailTesterTestPayload,
): Promise<MailTesterTest> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.mail_tester.create, payload);
        return response.data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, "Failed to start deliverability test."));
    }
};

export const refreshMailTesterTest = async (uuid: string): Promise<MailTesterTest> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.mail_tester.refresh(uuid), {});
        return response.data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, "Failed to refresh test result."));
    }
};
