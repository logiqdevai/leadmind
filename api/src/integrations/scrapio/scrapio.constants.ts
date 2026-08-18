export const SCRAPIO_API_BASE_URL = 'https://api.scrapio.logiqdev.com';

export const SCRAPIO_REQUEST_TIMEOUT_MS = 30_000;

export const SCRAPIO_MAX_RETRIES = 2;

export const SCRAPIO_RETRY_DELAY_MS = 2_000;

/** How long to wait for a Scrapio plain-scrape run to finish via its webhook before giving up. */
export const SCRAPIO_RUN_WAIT_TIMEOUT_MS = 120_000;

/** Terminal workflow-run events that carry a finished (or failed) plain-scrape result. */
export const SCRAPIO_TERMINAL_WEBHOOK_EVENTS = [
  'WORKFLOW_RUN_SUCCEEDED',
  'WORKFLOW_RUN_PARTIAL_SUCCESS',
  'WORKFLOW_RUN_FAILED',
  'WORKFLOW_RUN_CANCELLED',
] as const;
