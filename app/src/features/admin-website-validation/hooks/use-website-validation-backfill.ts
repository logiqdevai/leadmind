import { useMutation } from "@tanstack/react-query";
import { runWebsiteValidationBackfill } from "../services/website-validation-backfill.service";

export function useRunWebsiteValidationBackfill() {
    return useMutation({
        mutationFn: runWebsiteValidationBackfill,
    });
}
