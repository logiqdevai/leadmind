/**
 * Public booking services throw `Error` with the Nest error body as `cause`.
 * A 404 means the link/token is unknown or inactive (a friendly dead end, not a retryable failure).
 */
export function isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const cause = error.cause as { statusCode?: number } | undefined;
    return cause?.statusCode === 404;
}
