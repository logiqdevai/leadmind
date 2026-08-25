import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { MxToolboxClientModule } from '@/integrations/mxtoolbox/mxtoolbox-client.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { MxToolboxController } from './mxtoolbox.controller';
import { MxToolboxService } from './mxtoolbox.service';

@Module({
  imports: [
    PrismaModule,
    IntegrationsModule,
    MxToolboxClientModule,
    AiIntegrationModule,
  ],
  controllers: [MxToolboxController],
  providers: [MxToolboxService],
})
export class MxToolboxModule {}
