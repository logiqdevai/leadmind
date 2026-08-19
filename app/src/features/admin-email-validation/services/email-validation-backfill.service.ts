import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { EmailValidationBackfillResult } from "../interfaces/email-validation-backfill.interface";

export const runEmailValidationBackfill = async (): Promise<EmailValidationBackfillResult> => {
    const response = await axiosInstance.post<EmailValidationBackfillResult>(
        ApiRoutes.admin.email_validation_backfill,
        undefined,
        { timeout: 5 * 60 * 1000 },
    );
    return response.data;
};
