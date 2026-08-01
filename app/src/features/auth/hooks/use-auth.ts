import { adminLoginToAccount, refreshAccountToken, signIn, signUp } from "../services/auth";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SignInUser, SignUpUser } from "../interfaces/auth.interface";
import { Routes } from "@/routes/routes";
import type { LoggedInUser } from "@/features/user/interfaces/user.interface";
import { toast } from "@/hooks/use-toast";
import { formatAuthUser } from "@/features/auth/utils/auth.utils";
import { switchOrganisation } from "@/features/organisations/services/organisations.services";
import { getPreferredOrganisationUuid } from "@/lib/preferred-organisation";

function errMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "An unexpected error occurred";
}

function invitePath(token: string | null) {
    if (!token) return Routes.dashboard.root;
    return Routes.auth.invite.replace(":token", token);
}

export function useSignin() {
    const { login } = useAuthStore((state) => state);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    return useMutation({
        mutationFn: (data: SignInUser) => signIn(data),
        onSuccess: async (data: LoggedInUser) => {
            const preferredOrganisationUuid = data.user_uuid
                ? getPreferredOrganisationUuid(data.user_uuid)
                : null;

            login({
                ...data,
                isLoggedIn: true,
            });

            if (
                preferredOrganisationUuid &&
                preferredOrganisationUuid !== data.organisation_uuid
            ) {
                try {
                    const switched = await switchOrganisation(
                        preferredOrganisationUuid,
                    );
                    login({ ...formatAuthUser(switched), isLoggedIn: true });
                } catch {}
            }

            toast({
                title: "Login successful",
                description: "You have successfully logged in",
                duration: 2000,
            });
            navigate(invitePath(searchParams.get("invite")));
        },
        onError: (error: unknown) => {
            toast({
                title: "Could not sign in",
                description: errMessage(error),
                duration: 3000,
                variant: "error",
            });
        },
    });
}


export function useSignup() {
    const { login } = useAuthStore((state) => state);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    return useMutation({
        mutationFn: (data: SignUpUser) => signUp(data),
        onSuccess: (data, variables) => {
            login({
                ...data,
                isLoggedIn: true,
            });
            toast({
                title: "Register successful",
                description: "You have successfully registered in",
                duration: 2000,
            });
            navigate(
                invitePath(searchParams.get("invite") ?? variables.invite_token ?? null),
            );
        },
        onError: (error: unknown) => {
            toast({
                title: "Could not sign up",
                description: errMessage(error),
                duration: 3000,
                variant: "error",
            });
        },
    });
}


export function useRefreshAccountToken() {
    const { login } = useAuthStore((state) => state);
    return useMutation({
        mutationFn: () => refreshAccountToken(),
        onSuccess: (data: LoggedInUser) => {
            login({ ...data, isLoggedIn: true });
        },
    });
}

export function useAdminLoginToAccount() {
    const { login } = useAuthStore((state) => state);

    return useMutation({
        mutationFn: (account_uuid: string) => adminLoginToAccount(account_uuid),
        onSuccess: (data: LoggedInUser) => {
            toast({
                title: "Admin login successful",
                description: "You have successfully logged in as admin",
                duration: 2000,
            });
            login({
                ...data,
                isLoggedIn: true,
            });
        },
        onError: (error: unknown) => {
            toast({
                title: "Could not admin login to account",
                description: errMessage(error),
                duration: 3000,
                variant: "error",
            });
        },
    });
}