import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogInterceptor } from './interceptors/activity-log.interceptor';

@Module({
    imports: [PrismaModule],
    controllers: [ActivityLogsController],
    providers: [
        ActivityLogsService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ActivityLogInterceptor,
        },
    ],
    exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
