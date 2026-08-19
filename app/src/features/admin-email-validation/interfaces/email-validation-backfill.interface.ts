export interface EmailBackfillCounters {
    checked: number;
    invalidated: number;
    statusUpdated: number;
    errors: number;
}

export interface EmailValidationBackfillResult {
    leads: EmailBackfillCounters;
    contacts: EmailBackfillCounters;
    dry_run: boolean;
    started_at: string;
    completed_at: string;
}
