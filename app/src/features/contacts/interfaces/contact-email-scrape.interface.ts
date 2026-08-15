export interface ContactEmailScrapeJob {
    job_id: string;
    queued: number;
    skipped: number;
    completed: number;
    found: number;
    failed: number;
    not_found: number;
    started_at: number;
}

export interface ContactEmailScrapeStartedEvent {
    job_id: string;
    queued: number;
    skipped: number;
}

export interface ContactEmailScrapeProgressEvent {
    job_id: string;
    completed: number;
    total: number;
    found: number;
    failed: number;
    not_found: number;
}

export interface ContactEmailScrapeCompletedEvent {
    job_id: string;
    queued: number;
    found: number;
    failed: number;
    not_found: number;
}
