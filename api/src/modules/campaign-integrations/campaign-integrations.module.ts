import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { SendingPolicyModule } from '@/modules/sending-policy/sending-policy.module';
import { SendingCapacityModule } from '@/modules/sending-capacity/sending-capacity.module';
import { CampaignIntegrationsController } from './campaign-integrations.controller';
import { CampaignIntegrationsService } from './services/campaign-integrations.service';

@Module({
  imports: [PrismaModule, SendingPolicyModule, SendingCapacityModule],
  controllers: [CampaignIntegrationsController],
  providers: [CampaignIntegrationsService],
  exports: [CampaignIntegrationsService],
})
export class CampaignIntegrationsModule {}
