import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { OidcProviderService } from './services/oidc-provider.service';
import { OAuthConnectionsService } from './services/oauth-connections.service';
import { OAuthCleanupService } from './services/oauth-cleanup.service';
import { OAuthInteractionService } from './interaction/interaction.service';
import { OAuthInteractionController } from './interaction/interaction.controller';
import { OAuthConnectionsController } from './controllers/oauth-connections.controller';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ScheduleModule.forRoot()],
  controllers: [OAuthInteractionController, OAuthConnectionsController],
  providers: [
    OidcProviderService,
    OAuthConnectionsService,
    OAuthInteractionService,
    OAuthCleanupService,
  ],
  exports: [OidcProviderService, OAuthConnectionsService],
})
export class OAuthModule {}
