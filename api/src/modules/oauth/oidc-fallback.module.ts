import { Module } from '@nestjs/common';
import { OAuthModule } from './oauth.module';
import { OidcFallbackController } from './controllers/oidc-fallback.controller';

/**
 * Separate from OAuthModule and imported last in AppModule so its wildcard
 * catch-all controller (OidcFallbackController) is the very last route Nest
 * registers - see that controller for why this matters.
 */
@Module({
  imports: [OAuthModule],
  controllers: [OidcFallbackController],
})
export class OidcFallbackModule {}
