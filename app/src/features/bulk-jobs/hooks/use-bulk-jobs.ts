import { useQuery } from "@tanstack/react-query";
import { listBulkJobs } from "../services/bulk-jobs.service";
import { listAdminBulkJobs } from "../services/admin-bulk-jobs.service";
import {
    BulkJobStatus,
    type ListBulkJobsQuery,
    type ListBulkJobsResult,
} from "../interfaces/bulk-job.interface";

const ACTIVE_STATUSES = new Set<string>([
    BulkJobStatus.PENDING,
    BulkJobStatus.QUEUED,
    BulkJobStatus.RUNNING,
]);

export const bulkJobsQueryKeys = {
    all: ["bulk-jobs"] as const,
    list: (query: ListBulkJobsQuery) => [...bulkJobsQueryKeys.all, "list", query] as const,
};

export function useAdminBulkJobs(query: ListBulkJobsQuery) {
    return useQuery({
        queryKey: [...bulkJobsQueryKeys.all, "admin", query] as const,
        queryFn: () => listAdminBulkJobs(query),
        placeholderData: (prev) => prev,
        refetchInterval: (q) => {
            const data = q.state.data as ListBulkJobsResult | undefined;
            if (!data) return false;
            const anyActive = data.data.some((j) => ACTIVE_STATUSES.has(j.status));
            return anyActive ? 5_000 : false;
        },
    });
}

export function useBulkJobs(query: ListBulkJobsQuery) {
    return useQuery({
        queryKey: bulkJobsQueryKeys.list(query),
        queryFn: () => listBulkJobs(query),
        placeholderData: (prev) => prev,
        refetchInterval: (q) => {
            const data = q.state.data as ListBulkJobsResult | undefined;
            if (!data) return false;
            const anyActive = data.data.some((j) => ACTIVE_STATUSES.has(j.status));
            return anyActive ? 5_000 : false;
        },
    });
}
