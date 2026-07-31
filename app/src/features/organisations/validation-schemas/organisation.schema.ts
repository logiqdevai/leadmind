import { z } from "zod";
import { OrganisationInviteRoles } from "../interfaces/organisation.interfaces";

export const createOrganisationSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
});

export type CreateOrganisationFormData = z.infer<typeof createOrganisationSchema>;

export const updateOrganisationSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
});

export type UpdateOrganisationFormData = z.infer<typeof updateOrganisationSchema>;

export const createInvitationSchema = z.object({
    email: z.string().email("Valid email required"),
    role: z.enum([OrganisationInviteRoles.ADMIN, OrganisationInviteRoles.MEMBER]),
});

export type CreateInvitationFormData = z.infer<typeof createInvitationSchema>;
