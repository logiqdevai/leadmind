export const SCRAPIO_API_BASE_URL = 'https://api.scrapio.logiqdev.com';

export const SCRAPIO_REQUEST_TIMEOUT_MS = 30_000;

export const SCRAPIO_MAX_RETRIES = 2;

export const SCRAPIO_RETRY_DELAY_MS = 2_000;

/** How long to wait for a Scrapio plain-scrape run to finish via its webhook before giving up. */
export const SCRAPIO_RUN_WAIT_TIMEOUT_MS = 120_000;

/**
 * Built-in output_schema field descriptor for Scrapio's ready-made email regex extractor
 * (per Scrapio's OpenAPI spec: `{"type":"regex","pattern":"email"}` — "email"/"phone"/"url" are
 * built-in preset pattern names, as opposed to a raw regex source string). Confirmed against a
 * live run: with `extraction_scope: 'COMBINED'`, a field using this descriptor returns an ARRAY
 * of every matching email found across all scraped pages (e.g. `{ "emails": ["a@x.com", "b@y.com"] }`),
 * not a single value — the field key holding it should be named accordingly (e.g. `emails`).
 */
export const SCRAPIO_EMAIL_REGEX_FIELD = { type: 'regex', pattern: 'email' } as const;
