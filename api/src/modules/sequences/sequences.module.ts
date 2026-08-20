import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { OUTREACH_SEND_QUEUE } from '@/core/queues/queues.constants';
import { SequencesController } from './sequences.controller';
import { SequencesService } from './services/sequences.service';
import { SequenceEnrollmentService } from './services/sequence-enrollment.service';

@Module({
    imports: [
        PrismaModule,
        BullModule.registerQueue({ name: OUTREACH_SEND_QUEUE }),
    ],
    controllers: [SequencesController],
    providers: [SequencesService, SequenceEnrollmentService],
    exports: [SequencesService, SequenceEnrollmentService],
})
export class SequencesModule {}
