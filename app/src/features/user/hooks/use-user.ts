import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth";
import {
    changePassword,
    getMe,
    updateMe,
} from "../services/user.services";
import type {
    ChangePasswordDto,
    UpdateUserDto,
} from "../interfaces/user.interface";

export const userQueryKeys = {
    all: ["user"] as const,
    me: ["user", "me"] as const,
};

export function useGetMe() {
    return useQuery({
        queryKey: userQueryKeys.me,
        queryFn: getMe,
    });
}

export function useUpdateMe() {
    const queryClient = useQueryClient();
    const updateUser = useAuthStore((s) => s.updateUser);

    return useMutation({
        mutationFn: (dto: UpdateUserDto) => updateMe(dto),
        onSuccess: (user) => {
            queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
            updateUser({
                email: user.email,
                phone: user.phone,
                full_name: user.full_name ?? user.email.split("@")[0],
            });
            toast({ title: "Profile updated", duration: 1500 });
        },
        onError: (error) => {
            toast({
                title: "Could not update profile",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useChangePassword() {
    return useMutation({
        mutationFn: (dto: ChangePasswordDto) => changePassword(dto),
        onSuccess: () => {
            toast({ title: "Password changed", duration: 1500 });
        },
        onError: (error) => {
            toast({
                title: "Could not change password",
                description: error.message,
                variant: "error",
            });
        },
    });
}
