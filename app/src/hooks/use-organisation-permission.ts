import { type OrganisationPermissionKey } from "@/config/permissions";
import { hasOrganisationPermission } from "@/lib/has-organisation-permission";
import { useAuthStore } from "@/stores/auth";

export function useOrganisationPermission(permission: OrganisationPermissionKey): boolean {
  const role = useAuthStore((state) => state.organisation_role);
  return hasOrganisationPermission(role, permission);
}
