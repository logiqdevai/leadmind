import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateSavedContactFilterPayload,
    SavedContactFilter,
    UpdateSavedContactFilterPayload,
} from "../interfaces/saved-contact-filter.interface";

export const listSavedContactFilters = async (): Promise<SavedContactFilter[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.saved_contact_filters.list);
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to load saved filters.",
        );
    }
};

export const getSavedContactFilter = async (uuid: string): Promise<SavedContactFilter> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.saved_contact_filters.get(uuid));
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to load saved filter.",
        );
    }
};

export const createSavedContactFilter = async (
    payload: CreateSavedContactFilterPayload,
): Promise<SavedContactFilter> => {
    try {
        const response = await axiosInstance.post(
            ApiRoutes.saved_contact_filters.create,
            payload,
        );
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to save filter.",
        );
    }
};

export const updateSavedContactFilter = async (
    uuid: string,
    payload: UpdateSavedContactFilterPayload,
): Promise<SavedContactFilter> => {
    try {
        const response = await axiosInstance.patch(
            ApiRoutes.saved_contact_filters.update(uuid),
            payload,
        );
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to update saved filter.",
        );
    }
};

export const deleteSavedContactFilter = async (
    uuid: string,
): Promise<{ uuid: string }> => {
    try {
        const response = await axiosInstance.delete(
            ApiRoutes.saved_contact_filters.remove(uuid),
        );
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to delete saved filter.",
        );
    }
};
