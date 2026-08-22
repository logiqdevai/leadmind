import axios from "axios";
import { ApiRoutes } from "@/config/api/routes";
import { environments } from "@/config/environments";
import type { UnsubscribeResult } from "../interfaces/unsubscribe.interfaces";

const unsubscribeUrl = (token: string) =>
    `${environments.API_URL.replace(/\/$/, "")}${ApiRoutes.unsubscribe.confirm(token)}`;

export const previewUnsubscribe = async (token: string): Promise<UnsubscribeResult> => {
    try {
        const response = await axios.get<UnsubscribeResult>(unsubscribeUrl(token), {
            headers: { Accept: "application/json" },
        });
        return response.data;
    } catch {
        throw new Error("This unsubscribe link is invalid or has expired.");
    }
};

export const confirmUnsubscribe = async (token: string): Promise<UnsubscribeResult> => {
    try {
        const response = await axios.post<UnsubscribeResult>(unsubscribeUrl(token));
        return response.data;
    } catch {
        throw new Error("This unsubscribe link is invalid or has expired.");
    }
};

export const resubscribeByToken = async (token: string): Promise<UnsubscribeResult> => {
    try {
        const response = await axios.post<UnsubscribeResult>(
            `${environments.API_URL.replace(/\/$/, "")}${ApiRoutes.unsubscribe.resubscribe(token)}`,
        );
        return response.data;
    } catch {
        throw new Error("Could not restore this email preference.");
    }
};
