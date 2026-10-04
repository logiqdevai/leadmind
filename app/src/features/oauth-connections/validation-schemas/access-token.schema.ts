import { z } from "zod";
import { ACCESS_TOKEN_EXPIRY_VALUES, ACCESS_TOKEN_SCOPE_VALUES } from "../interfaces/oauth-connection.interfaces";

export const createAccessTokenSchema = z.object({
    expires_in: z.enum(ACCESS_TOKEN_EXPIRY_VALUES),
    scopes: z
        .array(z.enum(ACCESS_TOKEN_SCOPE_VALUES))
        .min(1, "Choose at least one permission"),
});

export type CreateAccessTokenFormData = z.infer<typeof createAccessTokenSchema>;
