import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
    BookingEventType,
    BookingNotificationKind,
    BookingNotificationStatus,
    BookingStatus,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BOOKING_NOTIFICATION_QUEUE } from '@/core/queues/queues.constants';
import { MessageSendService } from '@/modules/outreach/services/message-send.service';
import { OutreachRenderService } from '@/modules/outreach/services/outreach-render.service';
import { renderPlaceholders } from '@/shared/utils/placeholder-render.util';
import { BookingEventsService, SYSTEM_ACTOR } from './booking-events.service';
import {
    ACTIVE_BOOKING_STATUSES,
    BookingJobNames,
    NOTIFICATION_SEND_ATTEMPTS,
} from '../constants/booking.constants';
import { DEFAULT_INTERNAL_TEMPLATES, DEFAULT_INVITEE_TEMPLATES } from '../constants/booking-email-templates';
import { BookingNotificationJobData } from '../interfaces/booking.interface';
import {
    buildBookingVars,
    escapeHtml,
    escapeVars,
    googleCalendarTemplateUrl,
} from '../utils/booking-template-vars.util';

const NOTIFICATION_INCLUDE = {
    booking_page: {
        include: {
            confirmation_template: true,
            reminder_template: true,
            cancellation_template: true,
            reschedule_template: true,
        },
    },
    assigned_user: { select: { full_name: true, email: true } },
    organisation: { select: { name: true, timezone: true } },
} satisfies Prisma.BookingInclude;

type NotificationBooking = Prisma.BookingGetPayload<{ include: typeof NOTIFICATION_INCLUDE }>;

interface Recipient {
    email: string;
    internal: boolean;
}

/** Booking emails (confirmation, reminders, cancellation, reschedule) through the org's email infrastructure. */
@Injectable()
export class BookingNotificationsService {
    private readonly logger = new Logger(BookingNotificationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly messageSendService: MessageSendService,
        private readonly outreachRenderService: OutreachRenderService,
        private readonly events: BookingEventsService,
        @InjectQueue(BOOKING_NOTIFICATION_QUEUE) private readonly queue: Queue<BookingNotificationJobData>,
    ) {}

    /** Queue an immediate email (retried on failure). Duplicate enqueues for the same booking state collapse. */
    async enqueue(booking: { uuid: string; start_at: Date }, kind: BookingNotificationJobData['kind']) {
        await this.queue.add(
            BookingJobNames.SEND,
            { booking_uuid: booking.uuid, kind, scheduled_for_start: booking.start_at.toISOString() },
            {
                jobId: `booking-${kind.toLowerCase()}-${booking.uuid}-${booking.start_at.getTime()}`,
                attempts: NOTIFICATION_SEND_ATTEMPTS,
                backoff: { type: 'exponential', delay: 30_000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 7 * 86400 },
            },
        );
    }

    /** Delayed reminder jobs for the booking's current start time (one per configured offset). */
    async scheduleReminders(booking: { uuid: string; start_at: Date; booking_page_uuid: string | null }) {
        if (!booking.booking_page_uuid) return;
        const page = await this.prisma.bookingPage.findUnique({
            where: { uuid: booking.booking_page_uuid },
            select: { send_reminder_emails: true, reminder_offsets_minutes: true },
        });
        if (!page?.send_reminder_emails) return;

        for (const offset of page.reminder_offsets_minutes) {
            const sendAt = booking.start_at.getTime() - offset * 60_000;
            if (sendAt <= Date.now() + 60_000) continue;
            await this.queue.add(
                BookingJobNames.REMINDER,
                {
                    booking_uuid: booking.uuid,
                    kind: 'REMINDER',
                    offset_minutes: offset,
                    scheduled_for_start: booking.start_at.toISOString(),
                },
                {
                    jobId: this.reminderJobId(booking.uuid, offset, booking.start_at),
                    delay: sendAt - Date.now(),
                    attempts: NOTIFICATION_SEND_ATTEMPTS,
                    backoff: { type: 'exponential', delay: 60_000 },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 7 * 86400 },
                },
            );
        }
    }

    /** Removes reminder jobs queued for a previous start time (reschedule / cancel). */
    async cancelReminders(booking_uuid: string, start_at: Date, booking_page_uuid: string | null) {
        if (!booking_page_uuid) return;
        const page = await this.prisma.bookingPage.findUnique({
            where: { uuid: booking_page_uuid },
            select: { reminder_offsets_minutes: true },
        });
        for (const offset of page?.reminder_offsets_minutes ?? []) {
            try {
                const job = await this.queue.getJob(this.reminderJobId(booking_uuid, offset, start_at));
                if (job && !(await job.isActive())) await job.remove();
            } catch {
                // Already processed or removed - the worker also skips stale reminders.
            }
        }
    }

    /** Worker entry point. Throws on a failed send so BullMQ retries; per-recipient dedupe keeps it idempotent. */
    async process(job: BookingNotificationJobData) {
        const booking = await this.prisma.booking.findUnique({
            where: { uuid: job.booking_uuid },
            include: NOTIFICATION_INCLUDE,
        });
        if (!booking) return;

        const kind = job.kind as BookingNotificationKind;
        if (kind === BookingNotificationKind.REMINDER) {
            const stale = job.scheduled_for_start && new Date(job.scheduled_for_start).getTime() !== booking.start_at.getTime();
            // Pending bookings are not confirmed yet - don't remind people of a meeting that may not happen.
            const notConfirmed = !ACTIVE_BOOKING_STATUSES.includes(booking.status) || booking.status === BookingStatus.PENDING;
            if (stale || notConfirmed || booking.start_at <= new Date()) return;
        }
        if (kind === BookingNotificationKind.CANCELLATION && booking.status !== BookingStatus.CANCELLED) return;

        const recipients = this.recipientsFor(booking, kind);
        const failures: string[] = [];
        for (const recipient of recipients) {
            const ok = await this.sendOne(booking, kind, recipient, job.offset_minutes);
            if (!ok) failures.push(recipient.email);
        }
        if (failures.length) throw new Error(`Booking ${kind.toLowerCase()} email failed for ${failures.join(', ')}`);
    }

    private recipientsFor(booking: NotificationBooking, kind: BookingNotificationKind): Recipient[] {
        const page = booking.booking_page;
        const inviteeEnabled =
            !page ||
            {
                CONFIRMATION: page.send_confirmation_email,
                REMINDER: page.send_reminder_emails,
                CANCELLATION: page.send_cancellation_email,
                RESCHEDULE: page.send_reschedule_email,
            }[kind];

        const recipients: Recipient[] = [];
        if (inviteeEnabled) recipients.push({ email: booking.invitee_email, internal: false });
        if ((page?.notify_assignee ?? false) && booking.assigned_user?.email) {
            recipients.push({ email: booking.assigned_user.email, internal: true });
        }
        // Additional (admin) recipients get the important changes, not every reminder.
        if (kind !== BookingNotificationKind.REMINDER) {
            for (const email of page?.additional_recipients ?? []) recipients.push({ email, internal: true });
        }
        const seen = new Set<string>();
        return recipients.filter((r) => {
            const key = r.email.trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private async sendOne(
        booking: NotificationBooking,
        kind: BookingNotificationKind,
        recipient: Recipient,
        offset_minutes?: number,
    ): Promise<boolean> {
        const dedupe_key = [
            booking.uuid,
            kind,
            kind === BookingNotificationKind.CANCELLATION ? 'final' : booking.start_at.getTime(),
            offset_minutes ?? 0,
            recipient.email.toLowerCase(),
        ].join(':');

        const existing = await this.prisma.bookingNotification.findUnique({ where: { dedupe_key } });
        if (existing?.status === BookingNotificationStatus.SENT) return true;

        try {
            const { subject, html } = await this.compose(booking, kind, recipient);
            await this.messageSendService.sendTransactionalEmail(booking.organisation_uuid, {
                to: recipient.email,
                subject,
                html,
                // Invitee replies reach the assigned member directly.
                replyTo: recipient.internal ? null : booking.assigned_user?.email ?? null,
            });
            await this.prisma.bookingNotification.upsert({
                where: { dedupe_key },
                create: {
                    booking_uuid: booking.uuid,
                    kind,
                    recipient_email: recipient.email,
                    dedupe_key,
                    status: BookingNotificationStatus.SENT,
                    sent_at: new Date(),
                },
                update: { status: BookingNotificationStatus.SENT, error: null, sent_at: new Date() },
            });
            await this.events.record(booking, BookingEventType.NOTIFICATION_SENT, SYSTEM_ACTOR, `${labelFor(kind)} sent to ${recipient.email}`, {
                kind,
                recipient: recipient.email,
                offset_minutes: offset_minutes ?? null,
            });
            return true;
        } catch (error) {
            const message = (error as Error).message;
            this.logger.warn(`Booking ${booking.uuid} ${kind} to ${recipient.email} failed: ${message}`);
            await this.prisma.bookingNotification.upsert({
                where: { dedupe_key },
                create: {
                    booking_uuid: booking.uuid,
                    kind,
                    recipient_email: recipient.email,
                    dedupe_key,
                    status: BookingNotificationStatus.FAILED,
                    error: message,
                },
                update: { status: BookingNotificationStatus.FAILED, error: message },
            });
            await this.events.record(booking, BookingEventType.NOTIFICATION_FAILED, SYSTEM_ACTOR, `${labelFor(kind)} to ${recipient.email} failed`, {
                kind,
                recipient: recipient.email,
                error: message,
            });
            return false;
        }
    }

    private async compose(booking: NotificationBooking, kind: BookingNotificationKind, recipient: Recipient) {
        const page = booking.booking_page;
        const vars = {
            ...(await this.outreachRenderService.buildVarsForUser(booking.organisation_uuid)),
            ...buildBookingVars({
                booking,
                page,
                assignee: booking.assigned_user,
                organisation: booking.organisation,
                app_url: this.appUrl(),
                // Team members read times in the organisation timezone.
                display_timezone: recipient.internal ? booking.organisation.timezone : undefined,
            }),
        };

        const custom = recipient.internal ? null : templateFor(page, kind);
        const fallback = (recipient.internal ? DEFAULT_INTERNAL_TEMPLATES : DEFAULT_INVITEE_TEMPLATES)[kind];
        const subjectTemplate = custom?.email_subject || fallback.subject;
        const bodyTemplate = custom?.email_content || fallback.html;

        let html = renderPlaceholders(bodyTemplate, escapeVars(vars));
        if (kind !== BookingNotificationKind.CANCELLATION) html += this.extraBlocks(booking, vars, recipient);
        return { subject: renderPlaceholders(subjectTemplate, vars), html };
    }

    /** Meeting link and calendar details, appended unless the page turned them off. */
    private extraBlocks(booking: NotificationBooking, vars: Record<string, string>, recipient: Recipient): string {
        const page = booking.booking_page;
        const parts: string[] = [];
        if ((page?.include_meeting_link ?? true) && booking.meeting_url) {
            parts.push(`<p><strong>Join:</strong> <a href="${escapeHtml(booking.meeting_url)}">${escapeHtml(booking.meeting_url)}</a></p>`);
        }
        if ((page?.include_calendar_details ?? true) && !recipient.internal) {
            const addUrl = googleCalendarTemplateUrl(
                vars['booking.title'],
                booking.start_at,
                booking.end_at,
                `With ${vars['team_member.name']}. Manage: ${vars['booking.manage_url']}`,
                booking.meeting_url ?? vars['booking.location'],
            );
            parts.push(`<p><a href="${escapeHtml(addUrl)}">Add to Google Calendar</a></p>`);
        }
        return parts.join('');
    }

    private reminderJobId(booking_uuid: string, offset: number, start_at: Date) {
        return `booking-reminder-${booking_uuid}-${offset}-${start_at.getTime()}`;
    }

    private appUrl(): string {
        return this.configService.get<string>('APP_URL') ?? 'http://localhost:5173';
    }
}

function templateFor(page: NotificationBooking['booking_page'], kind: BookingNotificationKind) {
    if (!page) return null;
    return {
        CONFIRMATION: page.confirmation_template,
        REMINDER: page.reminder_template,
        CANCELLATION: page.cancellation_template,
        RESCHEDULE: page.reschedule_template,
    }[kind];
}

function labelFor(kind: BookingNotificationKind): string {
    return { CONFIRMATION: 'Confirmation', REMINDER: 'Reminder', CANCELLATION: 'Cancellation', RESCHEDULE: 'Reschedule notice' }[kind];
}
