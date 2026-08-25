import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelBulkJobs, listBulkJobs, retryBulkJobs } from "../services/bulk-jobs.service";
import { listAdminBulkJobs } from "../services/admin-bulk-jobs.service";
import {
    BulkJobStatus,
    type ListBulkJobsQuery,
    type ListBulkJobsResult,
} from "../interfaces/bulk-job.interface";
import { toast } from "@/hooks/use-toast";

const ACTIVE_STATUSES = new Set<string>([
    BulkJobStatus.PENDING,
    BulkJobStatus.QUEUED,
    BulkJobStatus.RUNNING,
]);

export const bulkJobsQueryKeys = {
    all: ["bulk-jobs"] as const,
    list: (query: ListBulkJobsQuery) => [...bulkJobsQueryKeys.all, "list", query] as const,
};

function summarizeActionResults(
    results: { ok: boolean; error?: string }[],
    action: "cancelled" | "retried",
) {
    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;
    if (failed === 0) {
        toast({
            title: `${ok} job${ok === 1 ? "" : "s"} ${action}`,
            duration: 2000,
        });
        return;
    }
    const firstError = results.find((r) => !r.ok)?.error;
    toast({
        title: `${ok} ${action}, ${failed} failed`,
        description: firstError,
        variant: "error",
    });
}

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

export function useCancelBulkJobs() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: cancelBulkJobs,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: bulkJobsQueryKeys.all });
            summarizeActionResults(data.results, "cancelled");
        },
        onError: (error: Error) => {
            toast({
                title: "Could not cancel jobs",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useRetryBulkJobs() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: retryBulkJobs,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: bulkJobsQueryKeys.all });
            summarizeActionResults(data.results, "retried");
        },
        onError: (error: Error) => {
            toast({
                title: "Could not retry jobs",
                description: error.message,
                variant: "error",
            });
        },
    });
}
