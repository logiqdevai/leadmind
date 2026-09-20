import { useQuery } from "@tanstack/react-query";
import type {
    ContactAudienceScope,
    ContactAudienceStatsQuery,
} from "../interfaces/contact-audience-stats.interface";
import {
    getCampaignAudienceStats,
    getFilterAudienceStats,
    getListAudienceStats,
    getOrganisationAudienceStats,
} from "../services/contact-audience-stats.service";

export const useContactAudienceStats = (
    scope: ContactAudienceScope | undefined,
    query?: ContactAudienceStatsQuery,
) => {
    const uuid = scope?.uuid ?? "";
    const scopeType = scope?.type;

    return useQuery({
        queryKey: ["contact-audience-stats", scopeType, uuid, query],
        queryFn: () => {
            if (!scope) throw new Error("Missing scope");
            if (scope.type === "organisation") return getOrganisationAudienceStats(query);
            if (scope.type === "filter") return getFilterAudienceStats(scope.uuid, query);
            if (scope.type === "campaign") return getCampaignAudienceStats(scope.uuid, query);
            return getListAudienceStats(scope.uuid, query);
        },
        enabled: scopeType === "organisation" ? true : !!uuid && !!scopeType,
    });
};
