import { z } from 'zod';

export const FOLLOW_UP_DRAFT_SCHEMA = z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(3000),
});

export type FollowUpDraftResult = z.infer<typeof FOLLOW_UP_DRAFT_SCHEMA>;
