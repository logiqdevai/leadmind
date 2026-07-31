import { z } from "zod";
import { GoalPeriods } from "../interfaces/messaging-goals.interfaces";

export const upsertMessagingGoalSchema = z.object({
    user_uuid: z.string().uuid("Select a team member"),
    period: z.enum([GoalPeriods.DAY, GoalPeriods.WEEK, GoalPeriods.MONTH]),
    target_count: z.coerce.number().int().min(1, "Target must be at least 1"),
});

export type UpsertMessagingGoalFormData = z.infer<typeof upsertMessagingGoalSchema>;

export const bulkGoalTargetSchema = z.object({
    period: z.enum([GoalPeriods.DAY, GoalPeriods.WEEK, GoalPeriods.MONTH]),
    target_count: z.coerce.number().int().min(1, "Target must be at least 1"),
});

export type BulkGoalTargetFormData = z.infer<typeof bulkGoalTargetSchema>;
