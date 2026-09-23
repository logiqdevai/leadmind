import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    OAuthInteractionDetails,
    OAuthInteractionResult,
} from "../interfaces/oauth-interaction.interfaces";

// These calls carry oidc-provider's own interaction/session cookies
// cross-origin (frontend origin -> API origin) - withCredentials is required
// on every one, on top of the API's own strict single-origin CORS policy
// for this path (see main.ts).
const WITH_CREDENTIALS = { withCredentials: true };

export const getOAuthInteraction = async (uid: string): Promise<OAuthInteractionDetails> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.oauth_interaction.get(uid), WITH_CREDENTIALS);
        return response.data;
    } catch {
        throw new Error("This connection request is invalid or has expired. Please try connecting again.");
    }
};

export const submitOAuthLogin = async (
    uid: string,
    organisation_uuid: string,
): Promise<OAuthInteractionResult> => {
    try {
        const response = await axiosInstance.post(
            ApiRoutes.oauth_interaction.login(uid),
            { organisation_uuid },
            WITH_CREDENTIALS,
        );
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Could not continue. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message, { cause: error });
    }
};

export const confirmOAuthConsent = async (uid: string): Promise<OAuthInteractionResult> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.oauth_interaction.confirm(uid), {}, WITH_CREDENTIALS);
        return response.data;
    } catch {
        throw new Error("Could not approve access. Please try again.");
    }
};

export const abortOAuthConsent = async (uid: string): Promise<OAuthInteractionResult> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.oauth_interaction.abort(uid), {}, WITH_CREDENTIALS);
        return response.data;
    } catch {
        throw new Error("Could not cancel. Please try again.");
    }
};
