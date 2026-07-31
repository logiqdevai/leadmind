import { z } from "zod";
import { TIMEZONE_VALUES } from "@/config/constants/dropdowns/timezone.options";
import { OrganisationInviteRoles } from "../interfaces/organisation.interfaces";

const timezoneSchema = z.enum(
    TIMEZONE_VALUES as unknown as [string, ...string[]],
    { message: "Select a timezone" },
);

export const createOrganisationSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
});

export type CreateOrganisationFormData = z.infer<typeof createOrganisationSchema>;

export const updateOrganisationSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    timezone: timezoneSchema,
});

export type UpdateOrganisationFormData = z.infer<typeof updateOrganisationSchema>;

export const createInvitationSchema = z.object({
    email: z.string().email("Valid email required"),
    role: z.enum([OrganisationInviteRoles.ADMIN, OrganisationInviteRoles.MEMBER]),
});

export type CreateInvitationFormData = z.infer<typeof createInvitationSchema>;
