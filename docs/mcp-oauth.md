# MCP + OAuth

Leadmind exposes its API as MCP tools, behind OAuth 2.1-style authorization, so Claude and
ChatGPT (and any other MCP-compatible agent) can act on a user's Leadmind workspace with the
user's own consent - one tool per documented API operation, auto-generated from the app's own
OpenAPI document, excluding admin/internal routes and a short list of deliberately-excluded
surfaces (see "What's excluded" below).

## Architecture

```
Claude / ChatGPT                Leadmind API (Nest, single process)
┌────────────────┐              ┌──────────────────────────────────────────────┐
│ MCP client      │  OAuth 2.1  │  oidc-provider (mounted at app root)          │
│ (Streamable     │◄───────────►│   /auth /token /reg /jwks /revocation ...     │
│  HTTP)          │  PKCE+DCR   │   /.well-known/openid-configuration           │
│                 │             │   /.well-known/oauth-authorization-server     │
│                 │             │                                                │
│                 │  Bearer JWT │  /oauth/interaction/:uid  (login + consent UI)│
│                 │◄───────────►│  /oauth/connections       (manage/revoke)     │
│                 │             │                                                │
│                 │             │  /.well-known/oauth-protected-resource/mcp    │
│                 │             │  POST/GET/DELETE /mcp     (McpController)     │
│                 │             │    -> McpAuthGuard (verify JWT locally)       │
│                 │             │    -> OpenApiToolRegistryService (tool list)  │
│                 │             │    -> ToolDispatcherService                   │
│                 │             │         -> loopback HTTP call, same path a    │
│                 │             │            normal API consumer would hit      │
│                 │             │         -> JwtGuard / OrganisationRolesGuard  │
│                 │             │            / ValidationPipe / service logic   │
└────────────────┘              └──────────────────────────────────────────────┘
```

### Why tools are generated from the OpenAPI document, not hand-written

`OpenApiToolRegistryService` (`api/src/modules/mcp/tool-registry/`) reads the same
`SwaggerModule.createDocument()` output already used for `/api` docs (via
`OpenApiDocumentRegistry`, set once in `main.ts`). For every documented path+method not on the
denylist, it builds an MCP tool: name, description (from `@ApiOperation summary`), a flattened
JSON Schema input (path params + query params + `body`, `$ref`s dereferenced inline), and a
required scope (`mcp:read` for GET, `mcp:write` otherwise).

This means:
- A route already hidden from the API docs with `@ApiExcludeController()` (every admin/internal
  controller today) is automatically hidden from MCP too - one annotation, not two places to keep
  in sync.
- A new endpoint becomes an MCP tool automatically, with zero MCP-specific code, as long as it's
  documented with `@ApiOperation`/`@ApiProperty` the way this codebase already does.
- Tool behavior can't drift from the real API: `ToolDispatcherService` doesn't call service
  methods directly, it re-enters the app over loopback HTTP (`http://127.0.0.1:$PORT`) with a
  short-lived (60s) internal JWT minted from the verified MCP token's claims, so every guard,
  the global `ValidationPipe`, and each controller's business logic run exactly as they do for
  any other authenticated request.

### What's excluded

Beyond `@ApiExcludeController()` (admin, internal - already excluded from the OpenAPI document
itself), `MCP_TOOL_PATH_DENYLIST` in `api/src/modules/mcp/tool-registry/mcp-tools.config.ts`
excludes:

| Path prefix | Why |
|---|---|
| `/auth` | An agent should never mint app sessions or create accounts on a user's behalf. |
| `/api-keys` | Minting a long-lived, full-access API key from inside a tool call would let an agent create a standing credential for itself outside the OAuth grant it was actually given. |
| `/public-api` | Same functionality already exists as ordinary tools (contacts, forms, ...); this surface is for third-party `X-API-Key` integrations, not agents. |
| `/webhooks`, `/t`, `/unsubscribe` | Inbound provider callbacks / public tracking pixels, not organisation-facing functionality. |
| `/oauth`, `/mcp`, `/.well-known` | The OAuth/MCP infrastructure itself. |

Everything else documented in the OpenAPI spec - contacts, contact lists, leads, sequences,
campaigns, message templates, threads, sender profiles, forms, reminders, filters, search,
dashboard, organisations, users, integrations, and so on - is exposed as a tool.

## Database

Three new tables (`api/prisma/schema.prisma`), no changes to any existing table's semantics:

- **`oauth_models`** - generic key/value store backing the `oidc-provider` adapter
  (`PrismaOidcAdapter`). One row per oidc-provider model instance (Client, Grant, Session,
  AccessToken, RefreshToken, AuthorizationCode, Interaction, PushedAuthorizationRequest, ...),
  keyed by `(model_name, key)`. This mirrors the "one collection, `${model}:${id}` key" pattern
  every community oidc-provider adapter uses instead of a bespoke Prisma model per concept.
- **`oauth_connections`** - org-facing "Connected apps" record (the OAuth equivalent of the
  existing `api_keys` table/UI): which third-party app, which scopes, granted by whom, revocable
  via `DELETE /oauth/connections/:uuid` (destroys every access/refresh token under that grant
  immediately via `revokeByGrantId`).
- **`mcp_tool_invocation_logs`** - audit trail of every tool call (organisation, user, OAuth
  client, tool name, path, status, duration), written by `ToolDispatcherService` after each
  dispatch. Needed for the security/traceability expectations both marketplaces' review
  guidelines call out, and useful for debugging/rate-limit decisions later.

**A migration has not been run.** Per this project's standing rule, database migrations are
never run by an agent. Once reviewed, run the usual flow for your environment, e.g.
`npm run migrate:staging:create` then `migrate:staging:deploy`, or `migrate:dev` locally.

## Subject / token design

An OAuth grant is always scoped to exactly one (user, organisation) pair - the same model the
existing `ApiKey` table already uses (`organisation_role` on the key). Rather than extend
oidc-provider's Grant storage with custom fields, the `accountId`/`sub` itself is the composite
`${user_uuid}::${organisation_uuid}` (`oauth.constants.ts`). `extraTokenClaims` re-verifies that
membership still exists on every token issuance and copies `user_uuid` / `organisation_uuid` /
`organisation_role` onto the JWT access token as top-level claims - `McpAuthGuard` reads them
directly, no extra DB round trip for the common case, plus a fast indexed membership check for
real-time revocation if someone is removed from an org mid-token-lifetime.

If a user belongs to more than one organisation, the login step (`/oauth/interaction/:uid`)
prompts them to pick which workspace the app is authorizing.

## OAuth library choice: `oidc-provider`

[`oidc-provider`](https://github.com/panva/node-oidc-provider) (panva) is the most widely
deployed certified OpenID Connect / OAuth 2.x provider for Node - actively maintained, used at
scale across the ecosystem - and, critically for this use case, it ships first-class support for
every piece both Claude's and OpenAI's MCP connector implementations expect:

- **PKCE** (RFC 7636), enforced (`pkce.required: () => true`) - required by OAuth 2.1.
- **Dynamic Client Registration** (RFC 7591) - Claude/ChatGPT self-register a client on first
  connect; no manual client provisioning.
- **Authorization Server Metadata** (RFC 8414) - `/.well-known/oauth-authorization-server` and
  `/.well-known/openid-configuration`, served automatically.
- **Resource Indicators** (RFC 8707) - the `resource` parameter binds an access token to exactly
  the Leadmind MCP resource (`getResourceServerInfo` rejects anything else), which is what the
  MCP Authorization spec (2025-06-18) requires to prevent a token issued for one resource server
  being replayed against another ("confused deputy").
- **Pushed Authorization Requests** (RFC 9126) - available, not required, for clients that
  support it.
- JWT-formatted access tokens, so `McpAuthGuard` verifies signatures locally
  (`jose.createLocalJWKSet`) against the server's own public keys - no network round trip per
  request.

## MCP transport

The official `@modelcontextprotocol/sdk`, using the Streamable HTTP transport (the current MCP
spec transport, replacing the older HTTP+SSE transport). `McpController` creates a fresh
low-level `Server` + transport per request in **stateless mode**
(`sessionIdGenerator: undefined`): there's no server-side conversational state to keep between
calls (every tool call re-enters the real API over HTTP), so statelessness is free and keeps the
endpoint horizontally scalable with no session affinity requirement.

## Resource server discovery (RFC 9728)

`ProtectedResourceController` serves `/.well-known/oauth-protected-resource/mcp` (and a bare
`/.well-known/oauth-protected-resource` fallback), pointing at the authorization server. Every
401 from `McpAuthGuard` also carries a `WWW-Authenticate: Bearer ... resource_metadata="..."`
header, so a compliant MCP client can discover how to authenticate without being told out of
band.

## Scopes

Two scopes, deliberately coarse (`oauth.constants.ts`):

- `mcp:read` - every GET-mapped tool.
- `mcp:write` - every POST/PUT/PATCH/DELETE-mapped tool.

Both Claude's and OpenAI's connector consent screens render the requested scope list to the end
user; a scope per API tag (`contacts:read`, `contacts:write`, `forms:read`, ...) would be more
granular but turns the consent screen into a wall of text for no real security benefit here,
since every token is already pinned to exactly one organisation. `OpenApiToolRegistryService`
already tags each tool with its required scope centrally, so moving to per-module scopes later is
a config change, not an architecture change.

## Marketplace requirements checklist

What's implemented vs. what's an operational/business step outside this codebase:

| Requirement | Status |
|---|---|
| OAuth 2.1 (PKCE required, no implicit flow) | Done |
| Dynamic Client Registration (RFC 7591) | Done |
| Authorization Server Metadata (RFC 8414) | Done (served by oidc-provider) |
| Protected Resource Metadata (RFC 9728) | Done (`ProtectedResourceController`) |
| Resource Indicators / audience binding (RFC 8707) | Done |
| Token revocation, immediate on "disconnect" | Done (`DELETE /oauth/connections/:uuid`) |
| MCP Streamable HTTP transport | Done |
| Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) | Done, derived from HTTP method |
| Per-tool JSON Schema input validation surfaced to the client | Done (from OpenAPI/DTO decorators) |
| Audit log of tool invocations | Done (`mcp_tool_invocation_logs`) |
| Admin/internal routes excluded | Done |
| HTTPS in production | Depends on hosting platform TLS termination - already required for the rest of the API, no new work |
| Stable signing keys across restarts (`OAUTH_JWKS`, `OAUTH_COOKIE_KEYS`) | Generate with `api/scripts/generate-oauth-keys.ts`, set in `.env.staging`/`.env.production` (see `.env.template`) - **required**, the app refuses to boot in staging/production without them |
| `MCP_RESOURCE_URL` / `OAUTH_ISSUER` env vars | Set in `.env.template`; default to `API_URL`/`${API_URL}/mcp` if unset |
| Branded login/consent pages | Minimal server-rendered pages ship today (`interaction.templates.ts`) - functional, unbranded. A polished version is a frontend task, not a protocol requirement, and can replace these without touching the OAuth flow |
| Server name/description/icon/legal URLs for marketplace listing submission | Not code - business/ops step: register the connector in each platform's developer console, supplying `resource_name`/support contact/privacy policy/terms URLs (`ProtectedResourceController.metadata()` has a couple of these fields already; add more if a submission form asks for them) |
| Security review / domain verification | Platform-side submission step, not implementable in advance |

## What to do next

1. Review this PR/branch.
2. Run the migration in your environment (never run by the agent - see rule above):
   `npm run migrate:staging:create` (or your environment's equivalent), then deploy it.
3. Generate and set `OAUTH_JWKS` / `OAUTH_COOKIE_KEYS` for every persistent environment:
   `npx ts-node -r tsconfig-paths/register scripts/generate-oauth-keys.ts` (run from `api/`, not the repo root).
4. Set `OAUTH_ISSUER` / `MCP_RESOURCE_URL` if you don't want the `API_URL`-derived defaults.
5. Point Claude's/ChatGPT's connector setup at `${API_URL}/mcp` - both platforms' Dynamic Client
   Registration flow takes it from there.
6. Optional follow-up: a "Connected apps" page in the `app/` frontend backed by the already-built
   `GET /oauth/connections` / `DELETE /oauth/connections/:uuid` endpoints (mirrors the existing
   API Keys settings page).
