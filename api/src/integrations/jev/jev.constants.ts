/** TypeSafe's own System One API (https://docs.typesafe.ai/api/system-one). */
export const JEV_BASE_URL = 'https://api.typesafe.ai/v1';
export const JEV_ENDPOINT = '/systemone';
export const JEV_REQUEST_TIMEOUT_MS = 20_000;

/** `jev-latest` floats to the newest release; the versioned id keeps tuned confidence thresholds stable (docs.typesafe.ai/models). */
export const JEV_DEFAULT_MODEL = 'jev-1.14.0';

/** Jev bills input tokens only ($42 per billion; output is free) and returns no cost field. */
export const JEV_INPUT_COST_USD_PER_TOKEN = 0.042 / 1_000_000;

/** Score questions accept up to 10 ordered levels (docs.typesafe.ai/api/system-one). */
export const JEV_SCORE_MIN_LEVELS = 2;
export const JEV_SCORE_MAX_LEVELS = 10;
