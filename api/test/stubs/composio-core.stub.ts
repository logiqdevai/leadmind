/**
 * Jest stand-in for `@composio/core`. The SDK ships as ESM only, which Jest's CommonJS runtime cannot
 * load (Node itself can, via require(esm)). Unit tests never reach Composio - they mock the services
 * that use it - but importing the module graph must not fail.
 */
export class Composio {
    constructor(_options?: unknown) {}
}
