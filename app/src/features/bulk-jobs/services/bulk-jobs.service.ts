import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { ListBulkJobsQuery, ListBulkJobsResult } from "../interfaces/bulk-job.interface";

export const listBulkJobs = async (query: ListBulkJobsQuery = {}): Promise<ListBulkJobsResult> => {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.status) params.set("status", query.status);
    if (query.type) params.set("type", query.type);
    if (query.active_only === false) params.set("active_only", "false");
    if (query.active_only === true) params.set("active_only", "true");

    const qs = params.toString();
    const response = await axiosInstance.get(
        qs ? `${ApiRoutes.bulk_jobs.list}?${qs}` : ApiRoutes.bulk_jobs.list,
    );
    return response.data;
};
