import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BOOKING_NOTIFICATION_QUEUE } from '@/core/queues/queues.constants';
import { BookingNotificationsService } from '@/modules/bookings/services/booking-notifications.service';
import { BookingNotificationJobData } from '@/modules/bookings/interfaces/booking.interface';

/** Sends booking emails: immediate (confirmation, cancellation, reschedule) and delayed reminders. */
@Processor(BOOKING_NOTIFICATION_QUEUE, { concurrency: 5 })
export class BookingNotificationWorker extends WorkerHost {
    constructor(private readonly notifications: BookingNotificationsService) {
        super();
    }

    async process(job: Job<BookingNotificationJobData>): Promise<void> {
        await this.notifications.process(job.data);
    }
}
