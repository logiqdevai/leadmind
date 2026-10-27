import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    deleteNotification,
    getUnreadNotificationCount,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "../services/notification.service";
import type { ListNotificationsQuery } from "../interfaces/notification.interface";

export const notificationQueryKeys = {
    all: ["notifications"] as const,
    list: (query: ListNotificationsQuery) => ["notifications", "list", query] as const,
    unreadCount: ["notifications", "unread-count"] as const,
};

export function useNotifications(query: ListNotificationsQuery = {}, options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: notificationQueryKeys.list(query),
        queryFn: () => listNotifications(query),
        staleTime: 30_000,
        enabled: options.enabled ?? true,
    });
}

export function useUnreadNotificationCount() {
    return useQuery({
        queryKey: notificationQueryKeys.unreadCount,
        queryFn: getUnreadNotificationCount,
        staleTime: 60_000,
    });
}

export function useMarkNotificationRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => markNotificationRead(uuid),
        onSuccess: () => qc.invalidateQueries({ queryKey: notificationQueryKeys.all }),
    });
}

export function useMarkAllNotificationsRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: markAllNotificationsRead,
        onSuccess: () => qc.invalidateQueries({ queryKey: notificationQueryKeys.all }),
        onError: (error: Error) => {
            toast({ title: "Could not mark as read", description: error.message, duration: 3000, variant: "error" });
        },
    });
}

export function useDeleteNotification() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteNotification(uuid),
        onSuccess: () => qc.invalidateQueries({ queryKey: notificationQueryKeys.all }),
        onError: (error: Error) => {
            toast({ title: "Could not delete notification", description: error.message, duration: 3000, variant: "error" });
        },
    });
}
