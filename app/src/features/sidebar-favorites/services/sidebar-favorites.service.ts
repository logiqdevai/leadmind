import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { SidebarFavorite } from "../interfaces/sidebar-favorite.interface";

export const listSidebarFavorites = async (): Promise<SidebarFavorite[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.sidebar_favorites.list);
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to load favorite links.",
        );
    }
};

export const addSidebarFavorite = async (nav_key: string): Promise<SidebarFavorite> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.sidebar_favorites.create, {
            nav_key,
        });
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to favorite link.",
        );
    }
};

export const removeSidebarFavorite = async (nav_key: string): Promise<{ nav_key: string }> => {
    try {
        const response = await axiosInstance.delete(
            ApiRoutes.sidebar_favorites.remove(nav_key),
        );
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to unfavorite link.",
        );
    }
};

export const reorderSidebarFavorites = async (
    nav_keys: string[],
): Promise<SidebarFavorite[]> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.sidebar_favorites.reorder, {
            nav_keys,
        });
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message || "Failed to reorder favorite links.",
        );
    }
};
