import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { SendingPolicyModule } from '@/modules/sending-policy/sending-policy.module';
import { SendingCapacityService } from './services/sending-capacity.service';

@Module({
  imports: [PrismaModule, SendingPolicyModule],
  providers: [SendingCapacityService],
  exports: [SendingCapacityService],
})
export class SendingCapacityModule {}
