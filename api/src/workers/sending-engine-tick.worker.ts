import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SENDING_ENGINE_TICK_QUEUE } from '@/core/queues/queues.constants';
import { SendingEngineService } from '@/modules/sending-engine/services/sending-engine.service';

/**
 * Single repeatable job (see SendingEngineModule.onModuleInit) that drives the whole
 * sending-policy pacing engine. concurrency: 1 avoids overlapping ticks racing each
 * other - the transactional reservation in SendingCapacityService is what actually
 * makes concurrent workers safe, this just avoids wasted duplicate work per tick.
 */
@Processor(SENDING_ENGINE_TICK_QUEUE, { concurrency: 1 })
export class SendingEngineTickWorker extends WorkerHost {
  private readonly logger = new Logger(SendingEngineTickWorker.name);

  constructor(private readonly sendingEngineService: SendingEngineService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const result = await this.sendingEngineService.tick();
    if (result.campaigns_processed > 0 || result.messages_sent > 0) {
      this.logger.log(
        `Tick jobId=${job.id}: ${result.campaigns_processed} campaign(s) considered, ${result.messages_sent} message(s) sent`,
      );
    }
  }
}
