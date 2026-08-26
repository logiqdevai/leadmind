import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { EnrichmentSource } from "@/features/enrichment/constants/enrichment-sources";
import type {
    BulkEnrichLeadsResponse,
    BulkEnrichContactsResponse,
    EnrichContactResponse,
    EnrichLeadResponse,
    EnrichmentEntityKind,
    ListEnrichmentsQuery,
    PaginatedEnrichments,
} from "../interfaces/enrichment.interfaces";

export const listEnrichments = async (
    kind: EnrichmentEntityKind,
    uuid: string,
    query: ListEnrichmentsQuery = {},
): Promise<PaginatedEnrichments> => {
    try {
        const url =
            kind === "lead"
                ? ApiRoutes.leads.enrichments(uuid)
                : ApiRoutes.contacts.enrichments(uuid);
        const response = await axiosInstance.get(url, { params: query });
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to load enrichments.");
    }
};

export const listLeadEnrichments = async (
    uuid: string,
    query: ListEnrichmentsQuery = {},
): Promise<PaginatedEnrichments> => listEnrichments("lead", uuid, query);

export const listContactEnrichments = async (
    uuid: string,
    query: ListEnrichmentsQuery = {},
): Promise<PaginatedEnrichments> => listEnrichments("contact", uuid, query);

export const enrichLead = async (
    uuid: string,
    payload: { sources?: EnrichmentSource[]; use_batch?: boolean } = {},
): Promise<EnrichLeadResponse> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.leads.enrich(uuid), payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to enqueue enrichment.");
    }
};

export const enrichLeadsBulk = async (payload: {
    uuids: string[];
    sources?: EnrichmentSource[];
    use_batch?: boolean;
}): Promise<BulkEnrichLeadsResponse> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.leads.bulk_enrich, payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to enqueue bulk enrichment.");
    }
};

export const enrichContact = async (
    uuid: string,
    payload: { sources?: EnrichmentSource[] } = {},
): Promise<EnrichContactResponse> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.contacts.enrich(uuid), payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to queue enrichment.");
    }
};

export const enrichContactsBulk = async (payload: {
    uuids: string[];
    sources?: EnrichmentSource[];
}): Promise<BulkEnrichContactsResponse> => {
    try {
        console.log("[bulk-enrich-debug] FE enrichContactsBulk request", payload);
        const response = await axiosInstance.post(ApiRoutes.contacts.bulk_enrich, payload);
        console.log("[bulk-enrich-debug] FE enrichContactsBulk response", response.data);
        return response.data;
    } catch (error: any) {
        console.log("[bulk-enrich-debug] FE enrichContactsBulk error", {
            message: error?.response?.data?.message || error?.message,
            status: error?.response?.status,
        });
        throw new Error(error?.response?.data?.message || "Failed to enqueue bulk enrichment.");
    }
};
