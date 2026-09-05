import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REPLY_ANALYSIS_QUEUE } from '@/core/queues/queues.constants';
import { ReplyAnalysisService } from '../services/reply-analysis.service';
import type { ReplyAnalysisJobData } from '../interfaces/reply-analysis-job.interface';

@Processor(REPLY_ANALYSIS_QUEUE)
export class ReplyAnalysisWorker extends WorkerHost {
    private readonly logger = new Logger(ReplyAnalysisWorker.name);

    constructor(private readonly replyAnalysisService: ReplyAnalysisService) {
        super();
    }

    async process(job: Job<ReplyAnalysisJobData>): Promise<void> {
        try {
            await this.replyAnalysisService.analyzeReply(job.data.message_uuid, job.data.note_uuid);
        } catch (error) {
            this.logger.error(
                `Failed to analyze reply for message=${job.data.message_uuid}: ${error instanceof Error ? error.message : error}`,
            );
        }
    }
}
