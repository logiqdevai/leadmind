import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OidcProviderService } from '../services/oidc-provider.service';

/**
 * Hands off any request no other (more specific) controller matched to the
 * oidc-provider Koa app - this is how /auth, /token, /reg, /jwks,
 * /revocation, /.well-known/openid-configuration,
 * /.well-known/oauth-authorization-server, etc. get served, since none of
 * those are Nest controllers themselves (see OidcProviderService for why
 * the issuer has no path prefix).
 *
 * Deliberately a real Nest route (not raw Express app.use() in main.ts):
 * Nest mounts its own controllers' routes onto the underlying Express app
 * at a point in its bootstrap that isn't part of its public contract, and
 * two different attempts at ordering a raw app.use() call around that
 * (before/after an explicit app.init()) each broke a different half of the
 * app - either oidc-provider's routes 404'd, or literally every Nest
 * controller did, because the raw middleware ended up ahead of Nest's own
 * router in the Express stack. Going through Nest's own routing sidesteps
 * that entirely: specific routes always take precedence over a wildcard
 * one, which is exactly why this module is imported last in AppModule too
 * (belt and suspenders - Nest's precedence already doesn't depend on it).
 */
@ApiExcludeController()
@Controller()
export class OidcFallbackController {
  constructor(private readonly oidc: OidcProviderService) {}

  @All('*')
  handle(@Req() req: Request, @Res() res: Response) {
    return this.oidc.callback()(req, res);
  }
}
