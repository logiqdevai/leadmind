/**
 * Path prefixes excluded from the MCP tool set, beyond what @ApiExcludeController()
 * already strips from the OpenAPI document (admin/internal modules).
 *
 * These are deliberate product/security decisions, not just "not part of the API":
 *  - /auth            - credential login/registration; an agent should never mint
 *                        app sessions or create accounts on a user's behalf.
 *  - /api-keys        - minting a long-lived, full-access API key from inside a
 *                        tool call would let an agent create a standing credential
 *                        for itself outside the OAuth grant it was given.
 *  - /public-api       - the same functionality already exists as ordinary tools
 *                        below (contacts, forms, ...); this surface exists for
 *                        third-party X-API-Key integrations, not agents.
 *  - /webhooks, /t,
 *    /unsubscribe      - inbound provider callbacks / public tracking pixels, not
 *                        organisation-facing functionality.
 *  - /oauth, /mcp,
 *    /.well-known      - the OAuth/MCP infrastructure itself.
 */
export const MCP_TOOL_PATH_DENYLIST = [
  '/',
  '/auth',
  '/api-keys',
  '/public-api',
  '/webhooks',
  '/t',
  '/unsubscribe',
  '/oauth',
  '/mcp',
  '/.well-known',
];

export function isDeniedPath(path: string): boolean {
  return MCP_TOOL_PATH_DENYLIST.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
