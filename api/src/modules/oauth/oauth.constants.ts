/**
 * Coarse, marketplace-friendly OAuth scopes. Every MCP tool maps to one of
 * SCOPE_READ / SCOPE_WRITE based on its HTTP method (see
 * mcp/tool-registry/openapi-tool-registry.service.ts). Kept deliberately
 * small: both Claude and OpenAI connector consent screens render the scope
 * list to the end user, and a long tag-per-scope list hurts that UX without
 * adding real security value for a single-tenant-per-token model (every
 * token is already pinned to exactly one organisation - see oidc-provider.service.ts).
 */
export const SCOPE_OPENID = 'openid';
export const SCOPE_OFFLINE_ACCESS = 'offline_access';
export const SCOPE_READ = 'mcp:read';
export const SCOPE_WRITE = 'mcp:write';

export const ALL_SCOPES = [
  SCOPE_OPENID,
  SCOPE_OFFLINE_ACCESS,
  SCOPE_READ,
  SCOPE_WRITE,
] as const;
export type OAuthScope = (typeof ALL_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<OAuthScope, string> = {
  [SCOPE_OPENID]: 'Confirm your identity',
  [SCOPE_OFFLINE_ACCESS]: 'Stay connected between sessions (refresh tokens)',
  [SCOPE_READ]: 'Read your Leadmind data (contacts, campaigns, forms, ...)',
  [SCOPE_WRITE]: 'Create, update, and delete your Leadmind data',
};

/** Separator between the user uuid and organisation uuid in the composite `sub`/accountId. */
export const ACCOUNT_ID_SEPARATOR = '::';

export function buildAccountId(
  userUuid: string,
  organisationUuid: string,
): string {
  return `${userUuid}${ACCOUNT_ID_SEPARATOR}${organisationUuid}`;
}

export function parseAccountId(
  accountId: string,
): { userUuid: string; organisationUuid: string } | undefined {
  const [userUuid, organisationUuid] = accountId.split(ACCOUNT_ID_SEPARATOR);
  if (!userUuid || !organisationUuid) return undefined;
  return { userUuid, organisationUuid };
}
