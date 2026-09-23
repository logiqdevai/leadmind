import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { OAuthModule } from '@/modules/oauth/oauth.module';
import { McpController } from './mcp.controller';
import { ProtectedResourceController } from './controllers/protected-resource.controller';
import { McpAuthGuard } from './guards/mcp-auth.guard';
import { OpenApiToolRegistryService } from './tool-registry/openapi-tool-registry.service';
import { ToolDispatcherService } from './tool-registry/tool-dispatcher.service';

@Module({
  imports: [PrismaModule, JwtModule.register({}), OAuthModule],
  controllers: [McpController, ProtectedResourceController],
  providers: [McpAuthGuard, OpenApiToolRegistryService, ToolDispatcherService],
})
export class McpModule {}
