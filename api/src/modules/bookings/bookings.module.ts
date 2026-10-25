import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { BOOKING_CALENDAR_SYNC_QUEUE, BOOKING_NOTIFICATION_QUEUE } from '@/core/queues/queues.constants';
import { ComposioModule } from '@/integrations/composio/composio.module';
import { GatewaysModule } from '@/gateways/gateways.module';
import { ContactsModule } from '@/modules/contacts/contacts.module';
import { OutreachModule } from '@/modules/outreach/outreach.module';
import { BookingLinksModule } from '@/modules/booking-links/booking-links.module';
import { RemindersModule } from '@/modules/reminders/reminders.module';
import { RateLimitGuard } from '@/shared/guards/rate-limit.guard';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingPagesController } from './controllers/booking-pages.controller';
import { AvailabilityController } from './controllers/availability.controller';
import { CalendarConnectionsController } from './controllers/calendar-connections.controller';
import { PublicBookingController } from './controllers/public-booking.controller';
import { AvailabilityService } from './services/availability.service';
import { BookingPagesService } from './services/booking-pages.service';
import { BookingSlotService } from './services/booking-slot.service';
import { BookingEventsService } from './services/booking-events.service';
import { BookingNotificationsService } from './services/booking-notifications.service';
import { BookingCalendarSyncService } from './services/booking-calendar-sync.service';
import { BookingTeamReminderService } from './services/booking-team-reminder.service';
import { CalendarConnectionsService } from './services/calendar-connections.service';
import { PublicBookingService } from './services/public-booking.service';

@Module({
    imports: [
        PrismaModule,
        ComposioModule,
        GatewaysModule,
        ContactsModule,
        OutreachModule,
        BookingLinksModule,
        RemindersModule,
        BullModule.registerQueue({ name: BOOKING_NOTIFICATION_QUEUE }, { name: BOOKING_CALENDAR_SYNC_QUEUE }),
    ],
    controllers: [
        BookingsController,
        BookingPagesController,
        AvailabilityController,
        CalendarConnectionsController,
        PublicBookingController,
    ],
    providers: [
        BookingsService,
        AvailabilityService,
        BookingPagesService,
        BookingSlotService,
        BookingEventsService,
        BookingNotificationsService,
        BookingCalendarSyncService,
        BookingTeamReminderService,
        CalendarConnectionsService,
        PublicBookingService,
        RateLimitGuard,
    ],
    exports: [BookingsService, BookingNotificationsService, BookingCalendarSyncService],
})
export class BookingsModule {}
