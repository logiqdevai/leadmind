import { InjectQueue } from '@nestjs/bullmq';
import { BullModule } from '@nestjs/bullmq';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import {
  SENDING_ENGINE_TICK_INTERVAL_MS,
  SENDING_ENGINE_TICK_JOB_ID,
  SENDING_ENGINE_TICK_QUEUE,
} from '@/core/queues/queues.constants';
import { SendingCapacityModule } from '@/modules/sending-capacity/sending-capacity.module';
import { IntegrationSelectionModule } from '@/modules/integration-selection/integration-selection.module';
import { SendingEngineService } from './services/sending-engine.service';

@Module({
  imports: [
    PrismaModule,
    SendingCapacityModule,
    IntegrationSelectionModule,
    BullModule.registerQueue({ name: SENDING_ENGINE_TICK_QUEUE }),
  ],
  providers: [SendingEngineService],
  exports: [SendingEngineService],
})
export class SendingEngineModule implements OnModuleInit {
  private readonly logger = new Logger(SendingEngineModule.name);

  constructor(
    @InjectQueue(SENDING_ENGINE_TICK_QUEUE)
    private readonly tickQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Idempotent: BullMQ dedupes repeatable jobs with the same jobId + repeat config.
    await this.tickQueue.add(
      SENDING_ENGINE_TICK_JOB_ID,
      {},
      {
        jobId: SENDING_ENGINE_TICK_JOB_ID,
        repeat: { every: SENDING_ENGINE_TICK_INTERVAL_MS },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
    this.logger.log(
      `Sending engine tick scheduled every ${SENDING_ENGINE_TICK_INTERVAL_MS}ms`,
    );
  }
}
