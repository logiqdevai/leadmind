import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BOOKING_NOTIFICATION_QUEUE } from '@/core/queues/queues.constants';
import { BookingNotificationsService } from '@/modules/bookings/services/booking-notifications.service';
import { BookingInvitationsService } from '@/modules/bookings/services/booking-invitations.service';
import { BookingJobNames } from '@/modules/bookings/constants/booking.constants';
import {
    BookingInviteReminderJobData,
    BookingNotificationJobData,
} from '@/modules/bookings/interfaces/booking.interface';

/**
 * Sends booking emails: immediate (confirmation, cancellation, reschedule), delayed meeting reminders,
 * and the follow-ups for booking links emailed to contacts.
 */
@Processor(BOOKING_NOTIFICATION_QUEUE, { concurrency: 5 })
export class BookingNotificationWorker extends WorkerHost {
    constructor(
        private readonly notifications: BookingNotificationsService,
        private readonly invitations: BookingInvitationsService,
    ) {
        super();
    }

    async process(job: Job<BookingNotificationJobData | BookingInviteReminderJobData>): Promise<void> {
        if (job.name === BookingJobNames.INVITE_REMINDER) {
            await this.invitations.processReminder(job.data as BookingInviteReminderJobData);
            return;
        }
        await this.notifications.process(job.data as BookingNotificationJobData);
    }
}
