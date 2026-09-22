import { z } from "zod";
import { OrganisationRoles } from "@/features/organisations/interfaces/organisation.interfaces";

export const createApiKeySchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    organisation_role: z.enum([
        OrganisationRoles.OWNER,
        OrganisationRoles.ADMIN,
        OrganisationRoles.MEMBER,
    ]),
    expires_at: z.string().optional().or(z.literal("")),
});

export type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>;
