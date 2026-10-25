import { useCallback, useMemo } from "react";
import { useCurrentOrganisation, useOrganisationMembers } from "@/features/organisations/hooks/use-organisations";
import type { OrganisationMember } from "@/features/organisations/interfaces/organisation.interfaces";
import { getBrowserTimezone } from "@/lib/timezone";
import { useAuthStore } from "@/stores/auth";

const resolveBrowserTimezone = (): string => {
    try {
        return getBrowserTimezone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
        return "UTC";
    }
};

/** Timezone every internal booking view renders in: the organisation's, falling back to the browser's. */
export function useBookingTimezone(): string {
    const { data: organisation } = useCurrentOrganisation();
    return organisation?.timezone || resolveBrowserTimezone();
}

export const memberLabel = (member: Pick<OrganisationMember, "full_name" | "email">): string =>
    member.full_name?.trim() || member.email;

/** Organisation members plus helpers to resolve names for booking UIs. */
export function useBookingMembers() {
    const organisationUuid = useAuthStore((s) => s.organisation_uuid) ?? "";
    const currentUserUuid = useAuthStore((s) => s.user_uuid);
    const { data: members = [], isLoading } = useOrganisationMembers(organisationUuid);

    const byUuid = useMemo(() => {
        const map = new Map<string, OrganisationMember>();
        for (const m of members) map.set(m.user_uuid, m);
        return map;
    }, [members]);

    const memberName = useCallback(
        (uuid: string | null | undefined): string => {
            if (!uuid) return "Unassigned";
            const member = byUuid.get(uuid);
            return member ? memberLabel(member) : "Team member";
        },
        [byUuid],
    );

    return { members, isLoading, currentUserUuid, memberName };
}
