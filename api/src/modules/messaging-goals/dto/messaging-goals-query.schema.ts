import { z } from 'zod';
import { GoalMetric, GoalPeriod } from '@/generated/prisma';

export const LeaderboardQuerySchema = z.object({
    period: z.nativeEnum(GoalPeriod).default(GoalPeriod.DAY),
    metric: z.nativeEnum(GoalMetric).default(GoalMetric.EMAIL),
});

export type LeaderboardQueryType = z.infer<typeof LeaderboardQuerySchema>;

export const AchievementsQuerySchema = z.object({
    unseen: z
        .string()
        .optional()
        .transform((v) => v === 'true' || v === '1'),
});

export type AchievementsQueryType = z.infer<typeof AchievementsQuerySchema>;
