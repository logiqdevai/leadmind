import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { listActivityLogs, undoActivityLog } from "../services/activity-logs.service";
import type { ListActivityLogsQuery } from "../interfaces/activity-log.interface";

export const activityLogsQueryKeys = {
    all: ["activity-logs"] as const,
    list: (query: ListActivityLogsQuery) =>
        [...activityLogsQueryKeys.all, "list", query] as const,
};

export function useActivityLogs(query: ListActivityLogsQuery) {
    return useQuery({
        queryKey: activityLogsQueryKeys.list(query),
        queryFn: () => listActivityLogs(query),
        placeholderData: (prev) => prev,
    });
}

export function useUndoActivityLog() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => undoActivityLog(uuid),
        onSuccess: () => {
            // The undone record can belong to any feature, so refresh every cached query.
            qc.invalidateQueries();
            toast({ title: "Action undone", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not undo",
                description: error.message,
                duration: 4000,
                variant: "error",
            });
        },
    });
}
