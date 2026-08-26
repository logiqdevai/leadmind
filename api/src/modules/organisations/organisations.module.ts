import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { CreateJwtServiceModule } from '@/shared/utils/jwt/jwt.module';
import { MailModule } from '@/modules/internal/mail/mail.module';
import { BulkJobsModule } from '@/modules/bulk-jobs/bulk-jobs.module';
import {
    ORGANISATION_DATA_COPY_QUEUE,
    REMINDER_TRIGGER_QUEUE,
} from '@/core/queues/queues.constants';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';
import { OrganisationDataCopyService } from './services/organisation-data-copy.service';

@Module({
    imports: [
        PrismaModule,
        CreateJwtServiceModule,
        MailModule,
        BulkJobsModule,
        BullModule.registerQueue(
            { name: ORGANISATION_DATA_COPY_QUEUE },
            { name: REMINDER_TRIGGER_QUEUE },
        ),
    ],
    controllers: [OrganisationsController],
    providers: [OrganisationsService, OrganisationDataCopyService],
    exports: [OrganisationsService, OrganisationDataCopyService],
})
export class OrganisationsModule {}
