import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { ThreadsController } from './threads.controller';
import { ThreadsService } from './threads.service';

@Module({
    imports: [PrismaModule],
    controllers: [ThreadsController],
    providers: [ThreadsService],
    exports: [ThreadsService],
})
export class ThreadsModule { }
