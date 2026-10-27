import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    AppNotification,
    ListNotificationsQuery,
    PaginatedNotifications,
} from "../interfaces/notification.interface";

export const listNotifications = async (query: ListNotificationsQuery = {}): Promise<PaginatedNotifications> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.notifications.list, { params: query });
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to load notifications.");
    }
};

export const getUnreadNotificationCount = async (): Promise<{ count: number }> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.notifications.unread_count);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to load unread notifications.");
    }
};

export const markNotificationRead = async (uuid: string): Promise<AppNotification> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.notifications.read(uuid));
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to mark notification as read.");
    }
};

export const markAllNotificationsRead = async (): Promise<{ updated: number }> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.notifications.read_all);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to mark notifications as read.");
    }
};

export const deleteNotification = async (uuid: string): Promise<{ uuid: string }> => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.notifications.remove(uuid));
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to delete notification.");
    }
};
