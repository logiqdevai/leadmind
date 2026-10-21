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

/**
 * Individual operations excluded from the MCP tool set even though the rest of
 * their path prefix is exposed. These act on the user's identity or on
 * organisations beyond the one the OAuth grant was issued for, which a
 * workspace-scoped connection must not be able to do:
 *  - account deletion / password change
 *  - creating, switching or deleting organisations
 *  - accepting an invitation (would join the user to another organisation)
 */
export const MCP_TOOL_OPERATION_DENYLIST: ReadonlyArray<{
  method: string;
  path: string;
}> = [
  { method: 'delete', path: '/users/me' },
  { method: 'patch', path: '/users/me/password' },
  { method: 'post', path: '/organisations' },
  { method: 'delete', path: '/organisations/{uuid}' },
  { method: 'post', path: '/organisations/{uuid}/switch' },
  { method: 'post', path: '/organisations/invitations/{token}/accept' },
];

export function isDeniedOperation(method: string, path: string): boolean {
  return MCP_TOOL_OPERATION_DENYLIST.some(
    (op) => op.method === method.toLowerCase() && op.path === path,
  );
}

/**
 * Organisation-management routes address an organisation by `{uuid}` in the
 * path rather than taking it from the caller's token, so a tool call must be
 * pinned to the organisation the connection was authorised for.
 */
export function isOrganisationScopedPath(pathTemplate: string): boolean {
  return pathTemplate.startsWith('/organisations/{uuid}');
}
