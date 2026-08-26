import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { OpenAiBatchJobsController } from './openai-batch-jobs.controller';
import { OpenAiBatchJobsService } from './openai-batch-jobs.service';

@Module({
  imports: [PrismaModule],
  controllers: [OpenAiBatchJobsController],
  providers: [OpenAiBatchJobsService],
})
export class OpenAiBatchJobsModule {}
