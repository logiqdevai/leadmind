import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { WebsiteValidationBackfillResult } from "../interfaces/website-validation-backfill.interface";

export const runWebsiteValidationBackfill = async (): Promise<WebsiteValidationBackfillResult> => {
    const response = await axiosInstance.post<WebsiteValidationBackfillResult>(
        ApiRoutes.admin.website_validation_backfill,
        undefined,
        { timeout: 5 * 60 * 1000 },
    );
    return response.data;
};
