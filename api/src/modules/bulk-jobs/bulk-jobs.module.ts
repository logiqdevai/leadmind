import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import {
    AI_PROCESS_QUEUE,
    FILTER_SCRAPE_QUEUE,
    MARKETING_CAMPAIGN_DISPATCH_QUEUE,
    MARKETING_MESSAGE_SEND_QUEUE,
    OUTREACH_SEND_QUEUE,
} from '@/core/queues/queues.constants';
import { BulkJobsController } from './bulk-jobs.controller';
import { BulkJobsService } from './bulk-jobs.service';

@Module({
    imports: [
        PrismaModule,
        BullModule.registerQueue(
            { name: AI_PROCESS_QUEUE },
            { name: FILTER_SCRAPE_QUEUE },
            { name: OUTREACH_SEND_QUEUE },
            { name: MARKETING_CAMPAIGN_DISPATCH_QUEUE },
            { name: MARKETING_MESSAGE_SEND_QUEUE },
        ),
    ],
    controllers: [BulkJobsController],
    providers: [BulkJobsService],
    exports: [BulkJobsService],
})
export class BulkJobsModule {}
