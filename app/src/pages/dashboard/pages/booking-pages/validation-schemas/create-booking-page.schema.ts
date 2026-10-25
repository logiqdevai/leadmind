import { z } from "zod";

export const createBookingPageSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    duration_minutes: z.number().int().min(5, "At least 5 minutes").max(720, "At most 12 hours"),
});

export type CreateBookingPageFormData = z.infer<typeof createBookingPageSchema>;
