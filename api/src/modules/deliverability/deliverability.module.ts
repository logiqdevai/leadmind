import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { DELIVERABILITY_CHECK_QUEUE } from '@/core/queues/queues.constants';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { MxToolboxModule } from '@/modules/mxtoolbox/mxtoolbox.module';
import { MailTesterModule } from '@/modules/mail-tester/mail-tester.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { JevClientModule } from '@/integrations/jev/jev.module';
import { DeliverabilityController } from './deliverability.controller';
import { DeliverabilityGuardService } from './services/deliverability-guard.service';
import { DeliverabilityRunnerService } from './services/deliverability-runner.service';
import { DeliverabilitySchedulerService } from './services/deliverability-scheduler.service';
import { DeliverabilitySchedulesService } from './services/deliverability-schedules.service';
import { DeliverabilityScoringService } from './services/deliverability-scoring.service';

@Module({
  imports: [
    PrismaModule,
    IntegrationsModule,
    MxToolboxModule,
    MailTesterModule,
    AiIntegrationModule,
    JevClientModule,
    BullModule.registerQueue({ name: DELIVERABILITY_CHECK_QUEUE }),
  ],
  controllers: [DeliverabilityController],
  providers: [
    DeliverabilitySchedulesService,
    DeliverabilitySchedulerService,
    DeliverabilityRunnerService,
    DeliverabilityScoringService,
    DeliverabilityGuardService,
  ],
  exports: [DeliverabilityRunnerService],
})
export class DeliverabilityModule {}
