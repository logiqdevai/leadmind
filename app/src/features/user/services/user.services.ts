import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ChangePasswordDto,
    UpdateUserDto,
    UserProfile,
} from "../interfaces/user.interface";

export const getMe = async (): Promise<UserProfile> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.users.me);
        return response.data;
    } catch {
        throw new Error("Failed to load profile. Please try again.");
    }
};

export const updateMe = async (dto: UpdateUserDto): Promise<UserProfile> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.users.me, dto);
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string | string[] } } })
                ?.response?.data?.message ?? "Failed to update profile. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message);
    }
};

export const changePassword = async (dto: ChangePasswordDto): Promise<{ success: boolean }> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.users.change_password, dto);
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string | string[] } } })
                ?.response?.data?.message ?? "Failed to change password. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message);
    }
};
