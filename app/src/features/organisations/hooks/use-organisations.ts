import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatAuthUser } from "@/features/auth/utils/auth.utils";
import { useAuthStore } from "@/stores/auth";
import {
    acceptInvitation,
    createInvitation,
    createOrganisation,
    deleteOrganisation,
    getCurrentOrganisation,
    listInvitations,
    listMembers,
    listOrganisations,
    previewInvitation,
    removeMember,
    resendInvitation,
    revokeInvitation,
    switchOrganisation,
    updateMemberRole,
    updateOrganisation,
} from "../services/organisations.services";
import type {
    CreateInvitationDto,
    CreateOrganisationDto,
    UpdateMemberRoleDto,
    UpdateOrganisationDto,
} from "../interfaces/organisation.interfaces";

export const organisationQueryKeys = {
    all: ["organisations"] as const,
    list: ["organisations", "list"] as const,
    current: ["organisations", "current"] as const,
    members: (uuid: string) => ["organisations", "members", uuid] as const,
    invitations: (uuid: string) => ["organisations", "invitations", uuid] as const,
    preview: (token: string) => ["organisations", "preview", token] as const,
};

export function useOrganisations() {
    return useQuery({
        queryKey: organisationQueryKeys.list,
        queryFn: listOrganisations,
    });
}

export function useCurrentOrganisation() {
    return useQuery({
        queryKey: organisationQueryKeys.current,
        queryFn: getCurrentOrganisation,
    });
}

export function useOrganisationMembers(uuid: string) {
    return useQuery({
        queryKey: organisationQueryKeys.members(uuid),
        queryFn: () => listMembers(uuid),
        enabled: !!uuid,
    });
}

export function useOrganisationInvitations(uuid: string) {
    return useQuery({
        queryKey: organisationQueryKeys.invitations(uuid),
        queryFn: () => listInvitations(uuid),
        enabled: !!uuid,
    });
}

export function useInvitationPreview(token: string) {
    return useQuery({
        queryKey: organisationQueryKeys.preview(token),
        queryFn: () => previewInvitation(token),
        enabled: !!token,
        retry: false,
    });
}

export function useCreateOrganisation() {
    const queryClient = useQueryClient();
    const login = useAuthStore((s) => s.login);

    return useMutation({
        mutationFn: (dto: CreateOrganisationDto) => createOrganisation(dto),
        onSuccess: (data) => {
            login({ ...formatAuthUser(data), isLoggedIn: true });
            queryClient.clear();
            toast({ title: "Organisation created", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not create organisation",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useUpdateOrganisation(uuid: string) {
    const queryClient = useQueryClient();
    const updateUser = useAuthStore((s) => s.updateUser);

    return useMutation({
        mutationFn: (dto: UpdateOrganisationDto) => updateOrganisation(uuid, dto),
        onSuccess: (data) => {
            updateUser({ organisation_name: data.name });
            queryClient.invalidateQueries({ queryKey: organisationQueryKeys.all });
            toast({ title: "Organisation updated", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update organisation",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useDeleteOrganisation() {
    const queryClient = useQueryClient();
    const login = useAuthStore((s) => s.login);

    return useMutation({
        mutationFn: (uuid: string) => deleteOrganisation(uuid),
        onSuccess: (data) => {
            login({ ...formatAuthUser(data), isLoggedIn: true });
            queryClient.clear();
            toast({ title: "Organisation deleted", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete organisation",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useSwitchOrganisation() {
    const queryClient = useQueryClient();
    const login = useAuthStore((s) => s.login);

    return useMutation({
        mutationFn: (uuid: string) => switchOrganisation(uuid),
        onSuccess: (data) => {
            login({ ...formatAuthUser(data), isLoggedIn: true });
            queryClient.clear();
            toast({ title: "Organisation switched", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not switch organisation",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useCreateInvitation(orgUuid: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: CreateInvitationDto) => createInvitation(orgUuid, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: organisationQueryKeys.invitations(orgUuid),
            });
            toast({ title: "Invitation sent", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not send invitation",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useResendInvitation(orgUuid: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (invitationUuid: string) => resendInvitation(orgUuid, invitationUuid),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: organisationQueryKeys.invitations(orgUuid),
            });
            toast({ title: "Invitation resent", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not resend invitation",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useRevokeInvitation(orgUuid: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (invitationUuid: string) => revokeInvitation(orgUuid, invitationUuid),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: organisationQueryKeys.invitations(orgUuid),
            });
            toast({ title: "Invitation revoked", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not revoke invitation",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useUpdateMemberRole(orgUuid: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            userUuid,
            dto,
        }: {
            userUuid: string;
            dto: UpdateMemberRoleDto;
        }) => updateMemberRole(orgUuid, userUuid, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: organisationQueryKeys.members(orgUuid),
            });
            toast({ title: "Role updated", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update role",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useRemoveMember(orgUuid: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userUuid: string) => removeMember(orgUuid, userUuid),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: organisationQueryKeys.members(orgUuid),
            });
            toast({ title: "Member removed", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not remove member",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useAcceptInvitation() {
    const queryClient = useQueryClient();
    const login = useAuthStore((s) => s.login);

    return useMutation({
        mutationFn: (token: string) => acceptInvitation(token),
        onSuccess: (data) => {
            login({ ...formatAuthUser(data), isLoggedIn: true });
            queryClient.clear();
            toast({ title: "Invitation accepted", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not accept invitation",
                description: error.message,
                variant: "error",
            });
        },
    });
}
