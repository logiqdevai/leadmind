import { z } from 'zod';

export const REPLY_ANALYSIS_SCHEMA = z.object({
    summary: z.string().min(1).max(2000),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    should_create_reminder: z.boolean(),
    reminder_title: z.string().max(200).optional(),
    reminder_notes: z.string().max(2000).optional(),
    reminder_type: z.enum(['GENERAL', 'CALL', 'EMAIL', 'MEETING', 'TASK']).optional(),
    remind_at: z.string().datetime().optional(),
});

export type ReplyAnalysisResult = z.infer<typeof REPLY_ANALYSIS_SCHEMA>;
