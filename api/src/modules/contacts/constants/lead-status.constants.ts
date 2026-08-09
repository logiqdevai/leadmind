import { LeadStatus } from '@/generated/prisma';

const LEAD_STATUS_RANK: Record<LeadStatus, number> = {
    [LeadStatus.ARCHIVED]: 0,
    [LeadStatus.LOST]: 1,
    [LeadStatus.NEW]: 2,
    [LeadStatus.CONTACTED]: 3,
    [LeadStatus.ENGAGED]: 4,
    [LeadStatus.QUALIFIED]: 5,
    [LeadStatus.NURTURING]: 6,
    [LeadStatus.OFFER_MADE]: 7,
    [LeadStatus.CONVERTED]: 8,
};

export function emptyLeadStatusCounts(): Record<LeadStatus, number> {
    return Object.fromEntries(
        Object.values(LeadStatus).map((status) => [status, 0]),
    ) as Record<LeadStatus, number>;
}

export function pickHigherLeadStatus(a: LeadStatus, b: LeadStatus): LeadStatus {
    return LEAD_STATUS_RANK[a] >= LEAD_STATUS_RANK[b] ? a : b;
}
