import { useQuery } from "@tanstack/react-query";
import { listActivityLogs } from "../services/activity-logs.service";
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
