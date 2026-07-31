import { RoleTypes, type RoleType } from "@/features/user/interfaces/user.interface";
import {
    OrganisationRoles,
    type OrganisationRole,
} from "@/features/organisations/interfaces/organisation.interfaces";

export const Permissions = {
  admin_nav: [RoleTypes.ADMIN, RoleTypes.SUPER_ADMIN],
  admin_batch_jobs: [RoleTypes.ADMIN, RoleTypes.SUPER_ADMIN],
  lead_enrichment_bulk: [RoleTypes.ADMIN, RoleTypes.SUPER_ADMIN],
  lead_delete: [RoleTypes.ADMIN, RoleTypes.SUPER_ADMIN],
  lead_edit: [RoleTypes.ADMIN, RoleTypes.SUPER_ADMIN],
  filter_outreach_instructions_edit: [RoleTypes.ADMIN, RoleTypes.SUPER_ADMIN],
} as const satisfies Record<string, RoleType[]>;

export type PermissionKey = keyof typeof Permissions;

export const OrganisationPermissions = {
  org_settings: [OrganisationRoles.OWNER, OrganisationRoles.ADMIN],
  org_invite: [OrganisationRoles.OWNER, OrganisationRoles.ADMIN],
  org_manage_members: [OrganisationRoles.OWNER, OrganisationRoles.ADMIN],
  org_manage_integrations: [OrganisationRoles.OWNER, OrganisationRoles.ADMIN],
  org_manage_goals: [OrganisationRoles.OWNER, OrganisationRoles.ADMIN],
  org_delete: [OrganisationRoles.OWNER],
} as const satisfies Record<string, OrganisationRole[]>;

export type OrganisationPermissionKey = keyof typeof OrganisationPermissions;
