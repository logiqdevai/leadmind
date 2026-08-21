import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { SendingPolicyController } from './sending-policy.controller';
import { SendingPolicyService } from './services/sending-policy.service';
import { SendingStageResolverService } from './services/sending-stage-resolver.service';

@Module({
  imports: [PrismaModule],
  controllers: [SendingPolicyController],
  providers: [SendingPolicyService, SendingStageResolverService],
  exports: [SendingPolicyService, SendingStageResolverService],
})
export class SendingPolicyModule {}
