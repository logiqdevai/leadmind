import { useMutation } from "@tanstack/react-query";
import { runEmailValidationBackfill } from "../services/email-validation-backfill.service";

export function useRunEmailValidationBackfill() {
    return useMutation({
        mutationFn: runEmailValidationBackfill,
    });
}
