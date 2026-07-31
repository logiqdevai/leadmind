import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ListActivityLogsQuery,
    ListActivityLogsResult,
} from "../interfaces/activity-log.interface";

function buildQueryString(query: ListActivityLogsQuery): string {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.entity_type) params.set("entity_type", query.entity_type);
    if (query.action) params.set("action", query.action);
    if (query.actor_user_uuid) params.set("actor_user_uuid", query.actor_user_uuid);
    if (query.search) params.set("search", query.search);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
}

export async function listActivityLogs(
    query: ListActivityLogsQuery = {},
): Promise<ListActivityLogsResult> {
    try {
        const response = await axiosInstance.get(
            `${ApiRoutes.activity_logs.list}${buildQueryString(query)}`,
        );
        return response.data;
    } catch {
        throw new Error("Failed to load activity history. Please try again.");
    }
}
