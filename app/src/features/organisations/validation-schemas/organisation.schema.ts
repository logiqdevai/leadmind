import { z } from "zod";
import { TIMEZONE_VALUES } from "@/config/constants/dropdowns/timezone.options";
import {
    OrganisationCopyCategories,
    OrganisationInviteRoles,
    type OrganisationCopyCategory,
} from "../interfaces/organisation.interfaces";

const timezoneSchema = z.enum(
    TIMEZONE_VALUES as unknown as [string, ...string[]],
    { message: "Select a timezone" },
);

const copyCategoryValues = Object.values(OrganisationCopyCategories) as [
    OrganisationCopyCategory,
    ...OrganisationCopyCategory[],
];

export const createOrganisationSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    source_organisation_uuid: z.string().uuid().optional().or(z.literal("")),
    copy_categories: z.array(z.enum(copyCategoryValues)).optional(),
});

export type CreateOrganisationFormData = z.infer<typeof createOrganisationSchema>;

export const updateOrganisationSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    timezone: timezoneSchema,
    reply_to_email: z.union([
        z.literal(""),
        z.string().trim().email("Valid email required").max(320),
    ]),
});

export type UpdateOrganisationFormData = z.infer<typeof updateOrganisationSchema>;

export const createInvitationSchema = z.object({
    email: z.string().email("Valid email required"),
    role: z.enum([OrganisationInviteRoles.ADMIN, OrganisationInviteRoles.MEMBER]),
});

export type CreateInvitationFormData = z.infer<typeof createInvitationSchema>;
