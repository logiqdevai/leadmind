import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { BulkJobsController } from './bulk-jobs.controller';
import { BulkJobsService } from './bulk-jobs.service';

@Module({
    imports: [PrismaModule],
    controllers: [BulkJobsController],
    providers: [BulkJobsService],
    exports: [BulkJobsService],
})
export class BulkJobsModule {}
