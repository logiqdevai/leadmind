import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    BulkUpdateOrgTagsPayload,
    CreateOrgTagPayload,
    OrgTag,
    OrgTagSummary,
    UpdateOrgTagPayload,
} from "../interfaces/org-tag.interface";

export const listOrgTags = async (): Promise<OrgTag[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.org_tags.list);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to load tags.");
    }
};

export const createOrgTag = async (payload: CreateOrgTagPayload): Promise<OrgTagSummary> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.org_tags.create, payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to create tag.");
    }
};

export const updateOrgTag = async (
    uuid: string,
    payload: UpdateOrgTagPayload,
): Promise<OrgTagSummary> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.org_tags.update(uuid), payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to update tag.");
    }
};

export const deleteOrgTag = async (uuid: string): Promise<void> => {
    try {
        await axiosInstance.delete(ApiRoutes.org_tags.remove(uuid));
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to delete tag.");
    }
};

export const bulkUpdateOrgTags = async (
    payload: BulkUpdateOrgTagsPayload,
): Promise<{ success: boolean; updated: number }> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.org_tags.bulk, payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to update tags.");
    }
};
