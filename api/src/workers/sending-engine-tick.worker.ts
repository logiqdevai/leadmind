import { Processor, WorkerHost } from '@nestjs/bullmq';
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
  constructor(private readonly sendingEngineService: SendingEngineService) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.sendingEngineService.tick();
  }
}
