/**
 * Thrown by a source's `execute*` method when it kicked off async external work (a Scrapio
 * plain-scrape run) instead of resolving inline. `runSource` treats this as "not finished yet" —
 * no success or failed attempt is persisted now; the webhook/timeout dispatcher finishes the
 * source later via the orchestrator's `finish*` method.
 */
export class DeferredEnrichmentError extends Error {
  constructor() {
    super('Enrichment source deferred to async completion');
    this.name = 'DeferredEnrichmentError';
  }
}
