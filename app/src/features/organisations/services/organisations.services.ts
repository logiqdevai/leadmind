import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateInvitationDto,
    CreateOrganisationDto,
    InvitationPreview,
    OrganisationCurrent,
    OrganisationInvitation,
    OrganisationMember,
    OrganisationSummary,
    UpdateMemberRoleDto,
    UpdateOrganisationDto,
} from "../interfaces/organisation.interfaces";

export const listOrganisations = async (): Promise<OrganisationSummary[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.organisations.list);
        return response.data;
    } catch {
        throw new Error("Failed to load organisations. Please try again.");
    }
};

export const getCurrentOrganisation = async (): Promise<OrganisationCurrent> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.organisations.current);
        return response.data;
    } catch {
        throw new Error("Failed to load organisation. Please try again.");
    }
};

export const createOrganisation = async (dto: CreateOrganisationDto) => {
    try {
        const response = await axiosInstance.post(ApiRoutes.organisations.create, dto);
        return response.data;
    } catch {
        throw new Error("Failed to create organisation. Please try again.");
    }
};

export const updateOrganisation = async (uuid: string, dto: UpdateOrganisationDto) => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.organisations.update(uuid), dto);
        return response.data;
    } catch {
        throw new Error("Failed to update organisation. Please try again.");
    }
};

export const deleteOrganisation = async (uuid: string) => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.organisations.remove(uuid));
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.message ||
                "Failed to delete organisation. Please try again.",
        );
    }
};

export const switchOrganisation = async (uuid: string) => {
    try {
        const response = await axiosInstance.post(ApiRoutes.organisations.switch(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to switch organisation. Please try again.");
    }
};

export const listMembers = async (uuid: string): Promise<OrganisationMember[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.organisations.members(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to load members. Please try again.");
    }
};

export const updateMemberRole = async (
    orgUuid: string,
    userUuid: string,
    dto: UpdateMemberRoleDto,
) => {
    try {
        const response = await axiosInstance.patch(
            ApiRoutes.organisations.updateMember(orgUuid, userUuid),
            dto,
        );
        return response.data;
    } catch {
        throw new Error("Failed to update member role. Please try again.");
    }
};

export const removeMember = async (orgUuid: string, userUuid: string) => {
    try {
        const response = await axiosInstance.delete(
            ApiRoutes.organisations.removeMember(orgUuid, userUuid),
        );
        return response.data;
    } catch {
        throw new Error("Failed to remove member. Please try again.");
    }
};

export const listInvitations = async (uuid: string): Promise<OrganisationInvitation[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.organisations.invitations(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to load invitations. Please try again.");
    }
};

export const createInvitation = async (uuid: string, dto: CreateInvitationDto) => {
    try {
        const response = await axiosInstance.post(
            ApiRoutes.organisations.createInvitation(uuid),
            dto,
        );
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message || "Failed to send invitation. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message);
    }
};

export const resendInvitation = async (orgUuid: string, invitationUuid: string) => {
    try {
        const response = await axiosInstance.post(
            ApiRoutes.organisations.resendInvitation(orgUuid, invitationUuid),
        );
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message || "Failed to resend invitation. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message);
    }
};

export const revokeInvitation = async (orgUuid: string, invitationUuid: string) => {
    try {
        const response = await axiosInstance.delete(
            ApiRoutes.organisations.revokeInvitation(orgUuid, invitationUuid),
        );
        return response.data;
    } catch {
        throw new Error("Failed to revoke invitation. Please try again.");
    }
};

export const previewInvitation = async (token: string): Promise<InvitationPreview> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.organisations.previewInvitation(token));
        return response.data;
    } catch {
        throw new Error("Invitation not found or expired.");
    }
};

export const acceptInvitation = async (token: string) => {
    try {
        const response = await axiosInstance.post(
            ApiRoutes.organisations.acceptInvitation(token),
        );
        return response.data;
    } catch (error: unknown) {
        const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message || "Failed to accept invitation. Please try again.";
        throw new Error(Array.isArray(message) ? message.join(", ") : message);
    }
};
