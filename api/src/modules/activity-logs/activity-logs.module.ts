import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityUndoRegistry } from './activity-undo.registry';
import { ActivityUndoService } from './activity-undo.service';
import { ActivityLogInterceptor } from './interceptors/activity-log.interceptor';

@Module({
    imports: [PrismaModule],
    controllers: [ActivityLogsController],
    providers: [
        ActivityLogsService,
        ActivityUndoRegistry,
        ActivityUndoService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ActivityLogInterceptor,
        },
    ],
    exports: [ActivityLogsService, ActivityUndoRegistry],
})
export class ActivityLogsModule {}
