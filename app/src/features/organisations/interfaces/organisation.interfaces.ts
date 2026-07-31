export const OrganisationRoles = {
    OWNER: "OWNER",
    ADMIN: "ADMIN",
    MEMBER: "MEMBER",
} as const;

export type OrganisationRole =
    (typeof OrganisationRoles)[keyof typeof OrganisationRoles];

export const OrganisationInviteRoles = {
    ADMIN: "ADMIN",
    MEMBER: "MEMBER",
} as const;

export type OrganisationInviteRole =
    (typeof OrganisationInviteRoles)[keyof typeof OrganisationInviteRoles];

export interface OrganisationSummary {
    uuid: string;
    name: string;
    slug: string;
    role: OrganisationRole;
    created_at: string;
    updated_at: string;
}

export interface OrganisationCurrent extends OrganisationSummary {}

export interface OrganisationMember {
    uuid: string;
    role: OrganisationRole;
    user_uuid: string;
    email: string;
    created_at: string;
}

export interface OrganisationInvitation {
    uuid: string;
    organisation_uuid: string;
    email: string;
    role: OrganisationInviteRole;
    token: string;
    status: string;
    expires_at: string;
    created_at: string;
}

export interface InvitationPreview {
    email: string;
    role: OrganisationInviteRole;
    organisation_name: string;
    organisation_uuid: string;
    expires_at: string;
}

export interface CreateOrganisationDto {
    name: string;
}

export interface UpdateOrganisationDto {
    name?: string;
}

export interface CreateInvitationDto {
    email: string;
    role: OrganisationInviteRole;
}

export interface UpdateMemberRoleDto {
    role: OrganisationRole;
}
