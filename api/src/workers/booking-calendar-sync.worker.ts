import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BOOKING_CALENDAR_SYNC_QUEUE } from '@/core/queues/queues.constants';
import { BookingCalendarSyncService } from '@/modules/bookings/services/booking-calendar-sync.service';
import { BookingNotificationsService } from '@/modules/bookings/services/booking-notifications.service';
import { CalendarSyncJobData } from '@/modules/bookings/interfaces/booking.interface';

@Processor(BOOKING_CALENDAR_SYNC_QUEUE, { concurrency: 5 })
export class BookingCalendarSyncWorker extends WorkerHost {
    private readonly logger = new Logger(BookingCalendarSyncWorker.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calendarSync: BookingCalendarSyncService,
        private readonly notifications: BookingNotificationsService,
    ) {
        super();
    }

    async process(job: Job<CalendarSyncJobData>): Promise<void> {
        const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        try {
            await this.calendarSync.process(job.data, isLastAttempt);
        } catch (error) {
            const final = isLastAttempt || error instanceof UnrecoverableError;
            // The confirmation was held back for the Meet link; never let a sync failure swallow it.
            if (final) await this.sendHeldConfirmation(job.data);
            throw error;
        }
        await this.sendHeldConfirmation(job.data);
    }

    private async sendHeldConfirmation(data: CalendarSyncJobData) {
        if (!data.notify_confirmation_after) return;
        const booking = await this.prisma.booking.findUnique({
            where: { uuid: data.booking_uuid },
            select: { uuid: true, start_at: true },
        });
        if (!booking) return;
        try {
            await this.notifications.enqueue(booking, 'CONFIRMATION');
        } catch (error) {
            this.logger.error(`Could not queue confirmation for booking ${booking.uuid}: ${(error as Error).message}`);
        }
    }
}
