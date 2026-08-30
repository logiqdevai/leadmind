export interface WebsiteBackfillCounters {
    checked: number;
    invalidated: number;
    statusUpdated: number;
    errors: number;
}

export interface WebsiteValidationBackfillResult {
    leads: WebsiteBackfillCounters;
    contacts: WebsiteBackfillCounters;
    dry_run: boolean;
    started_at: string;
    completed_at: string;
}
