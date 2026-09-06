import { Prisma } from '@/generated/prisma';

export function belowScoreContactFilter(minScore: number): Prisma.ContactWhereInput {
    return {
        AND: [
            { contact_scores: { some: { score: { lt: minScore } } } },
            { contact_scores: { none: { score: { gte: minScore } } } },
        ],
    };
}
