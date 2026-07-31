import { z } from "zod";

export const updateProfileSchema = z.object({
    full_name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().optional(),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
    .object({
        current_password: z.string().min(1, "Current password is required"),
        new_password: z.string().min(6, "Password must be at least 6 characters"),
        confirm_password: z.string().min(1, "Confirm your new password"),
    })
    .refine((data) => data.new_password === data.confirm_password, {
        message: "Passwords do not match",
        path: ["confirm_password"],
    });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
