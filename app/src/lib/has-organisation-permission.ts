import {
  OrganisationPermissions,
  type OrganisationPermissionKey,
} from "@/config/permissions";
import {
  OrganisationRoles,
  type OrganisationRole,
} from "@/features/organisations/interfaces/organisation.interfaces";

export function hasOrganisationPermission(
  role: OrganisationRole | string | null | undefined,
  permission: OrganisationPermissionKey,
): boolean {
  if (!role) {
    return false;
  }
  if (role === OrganisationRoles.OWNER) {
    return true;
  }
  return (OrganisationPermissions[permission] as readonly string[]).includes(role);
}
