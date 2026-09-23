import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { OidcProviderService } from '@/modules/oauth/services/oidc-provider.service';
import { SCOPE_READ, SCOPE_WRITE } from '@/modules/oauth/oauth.constants';

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728), the piece of the MCP
 * Authorization spec that lets a client discover which authorization
 * server(s) protect this resource before starting the OAuth flow. Served at
 * both the resource-specific path RFC 9728's insertion algorithm expects for
 * a resource with a path component (`/.well-known/oauth-protected-resource/mcp`
 * for resource `${API_URL}/mcp`) and the bare fallback some clients still
 * probe first.
 */
@ApiExcludeController()
@Controller('.well-known/oauth-protected-resource')
export class ProtectedResourceController {
  constructor(private readonly oidc: OidcProviderService) {}

  @Get()
  root() {
    return this.metadata();
  }

  @Get('mcp')
  mcp() {
    return this.metadata();
  }

  private metadata() {
    return {
      resource: this.oidc.mcpResourceUrl,
      authorization_servers: [this.oidc.issuer],
      bearer_methods_supported: ['header'],
      scopes_supported: [SCOPE_READ, SCOPE_WRITE],
      resource_name: 'Leadmind',
    };
  }
}
