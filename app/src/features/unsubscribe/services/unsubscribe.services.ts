import axios from "axios";
import { ApiRoutes } from "@/config/api/routes";
import { environments } from "@/config/environments";
import type { UnsubscribeResult } from "../interfaces/unsubscribe.interfaces";

export const confirmUnsubscribe = async (token: string): Promise<UnsubscribeResult> => {
    try {
        const response = await axios.post<UnsubscribeResult>(
            `${environments.API_URL.replace(/\/$/, "")}${ApiRoutes.unsubscribe.confirm(token)}`,
        );
        return response.data;
    } catch {
        throw new Error("This unsubscribe link is invalid or has expired.");
    }
};
