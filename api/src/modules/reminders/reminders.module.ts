import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { GatewaysModule } from '@/gateways/gateways.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { REMINDER_TRIGGER_QUEUE } from '@/core/queues/queues.constants';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { FollowUpDraftService } from './services/follow-up-draft.service';
import { ReminderCalendarService } from './services/reminder-calendar.service';
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';
import { ComposioModule } from '@/integrations/composio/composio.module';

@Module({
    imports: [
        PrismaModule,
        ActivityLogsModule,
        ComposioModule,
        GatewaysModule,
        AiIntegrationModule,
        BullModule.registerQueue({ name: REMINDER_TRIGGER_QUEUE }),
    ],
    controllers: [RemindersController],
    providers: [RemindersService, FollowUpDraftService, ReminderCalendarService],
    exports: [RemindersService, FollowUpDraftService],
})
export class RemindersModule {}
