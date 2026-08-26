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
    timezone: string;
    reply_to_email: string | null;
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
    full_name: string | null;
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

export const OrganisationCopyCategories = {
    SENDER_PROFILES: "SENDER_PROFILES",
    TEMPLATES: "TEMPLATES",
    INTEGRATIONS: "INTEGRATIONS",
    FILTERS: "FILTERS",
    CONTACTS: "CONTACTS",
    LISTS: "LISTS",
    SEQUENCES: "SEQUENCES",
    CAMPAIGNS: "CAMPAIGNS",
    FORMS: "FORMS",
    REMINDERS: "REMINDERS",
    USERS: "USERS",
    GOALS: "GOALS",
    INTEGRATION_GOALS: "INTEGRATION_GOALS",
} as const;

export type OrganisationCopyCategory =
    (typeof OrganisationCopyCategories)[keyof typeof OrganisationCopyCategories];

export const OrganisationCopyCategoryLabels: Record<OrganisationCopyCategory, string> = {
    SENDER_PROFILES: "Sender profiles",
    TEMPLATES: "Templates",
    INTEGRATIONS: "Integrations",
    FILTERS: "Filters",
    CONTACTS: "Contacts",
    LISTS: "Lists",
    SEQUENCES: "Sequences",
    CAMPAIGNS: "Campaigns",
    FORMS: "Forms",
    REMINDERS: "Reminders",
    USERS: "Users",
    GOALS: "Goals",
    INTEGRATION_GOALS: "Integration goals",
};

export interface CreateOrganisationDto {
    name: string;
    source_organisation_uuid?: string;
    copy_categories?: OrganisationCopyCategory[];
}

export interface UpdateOrganisationDto {
    name?: string;
    timezone?: string;
    reply_to_email?: string | null;
}

export interface CreateInvitationDto {
    email: string;
    role: OrganisationInviteRole;
}

export interface UpdateMemberRoleDto {
    role: OrganisationRole;
}
