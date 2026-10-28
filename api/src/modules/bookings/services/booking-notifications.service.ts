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
import { bookingLinkHtml } from '@/modules/booking-links/booking-links.service';
import { renderPlaceholders } from '@/shared/utils/placeholder-render.util';
import { BookingEventsService, SYSTEM_ACTOR } from './booking-events.service';
import {
    ACTIVE_BOOKING_STATUSES,
    BookingJobNames,
    NOTIFICATION_SEND_ATTEMPTS,
} from '../constants/booking.constants';
import { DEFAULT_INTERNAL_TEMPLATES, DEFAULT_INVITEE_TEMPLATES } from '../constants/booking-email-templates';
import { BookingNotificationJobData } from '../interfaces/booking.interface';
import { pickTemplateForLanguage, resolveRecipientLanguage } from '../utils/booking-template-language.util';
import {
    buildBookingVars,
    escapeHtml,
    escapeVars,
    googleCalendarTemplateUrl,
} from '../utils/booking-template-vars.util';

const NOTIFICATION_INCLUDE = {
    booking_page: {
        include: {
            // Every template the page offers; compose() picks the one matching the recipient's language.
            notification_templates: { include: { template: true }, orderBy: { created_at: 'asc' } },
        },
    },
    contact: { select: { country: true } },
    assigned_user: { select: { full_name: true, email: true } },
    organisation: { select: { name: true, timezone: true, slug: true } },
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

    /** Manual resend of the confirmation to the invitee, bypassing the page toggle and the already-sent dedupe. */
    async resendConfirmation(booking_uuid: string): Promise<boolean> {
        const booking = await this.prisma.booking.findUnique({
            where: { uuid: booking_uuid },
            include: NOTIFICATION_INCLUDE,
        });
        if (!booking?.invitee_email) return false;
        return this.sendOne(booking, BookingNotificationKind.CONFIRMATION, { email: booking.invitee_email, internal: false }, undefined, true);
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
        force = false,
    ): Promise<boolean> {
        const dedupe_key = [
            booking.uuid,
            kind,
            kind === BookingNotificationKind.CANCELLATION ? 'final' : booking.start_at.getTime(),
            offset_minutes ?? 0,
            recipient.email.toLowerCase(),
        ].join(':');

        const existing = await this.prisma.bookingNotification.findUnique({ where: { dedupe_key } });
        if (!force && existing?.status === BookingNotificationStatus.SENT) return true;

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
            // Signature and sender details of the assigned member's profile, else the default profile.
            ...(await this.outreachRenderService.buildVarsForTeamMember(booking.organisation_uuid, booking.assigned_user_uuid)),
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

        const custom = recipient.internal ? null : templateFor(booking, kind);
        const fallback = (recipient.internal ? DEFAULT_INTERNAL_TEMPLATES : DEFAULT_INVITEE_TEMPLATES)[kind];
        const subjectTemplate = custom?.email_subject || fallback.subject;
        const bodyTemplate = custom?.email_content || fallback.html;

        // The sender profile's signature is org-authored HTML, so it must not be escaped like invitee-typed values.
        // Without one (or without a default profile) `{{signature}}` falls back to a plain team-member sign-off
        // instead of rendering as an empty gap.
        const signature = vars.signature?.trim() || this.fallbackSignature(vars);
        // Cancelled meetings can't be rescheduled, so the invitee is offered the booking page to pick a new time.
        const language = custom?.language ?? resolveRecipientLanguage({ contact_country: booking.contact?.country, invitee_language: booking.invitee_language });
        const bookAgainUrl = vars['booking.book_again_url'];
        const bookAgainLink = bookAgainUrl ? bookingLinkHtml(bookAgainUrl, language === 'el' ? 'Κλείστε νέα ώρα' : 'Book a new time') : '';
        const usesBookAgain = /\{\{\s*booking\.book_again_(url|link)\s*\}\}/.test(bodyTemplate);
        const extra =
            kind !== BookingNotificationKind.CANCELLATION
                ? this.extraBlocks(booking, vars, recipient)
                : recipient.internal || usesBookAgain
                  ? ''
                  : bookAgainLink;
        // The signature closes the email, so the join / calendar links go right before it; templates without
        // {{signature}} simply get them at the end.
        const hasSignature = /\{\{\s*signature\s*\}\}/.test(bodyTemplate);
        let html = renderPlaceholders(bodyTemplate, { ...escapeVars(vars), 'booking.book_again_link': bookAgainLink, signature: hasSignature ? extra + signature : signature });
        if (!hasSignature) html += extra;
        return { subject: renderPlaceholders(subjectTemplate, vars), html };
    }

    private fallbackSignature(vars: Record<string, string>): string {
        const lines = [vars['team_member.name'], vars['brand.name']].map((v) => v?.trim()).filter(Boolean);
        return lines.length ? `<p>${lines.map((l) => escapeHtml(l)).join('<br>')}</p>` : '';
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

/** The page's template for this email type written in the recipient's language (see pickTemplateForLanguage). */
function templateFor(booking: NotificationBooking, kind: BookingNotificationKind) {
    const candidates = (booking.booking_page?.notification_templates ?? [])
        .filter((row) => row.kind === kind)
        .map((row) => row.template);
    const language = resolveRecipientLanguage({
        contact_country: booking.contact?.country,
        invitee_language: booking.invitee_language,
    });
    return pickTemplateForLanguage(candidates, language);
}

function labelFor(kind: BookingNotificationKind): string {
    return { CONFIRMATION: 'Confirmation', REMINDER: 'Reminder', CANCELLATION: 'Cancellation', RESCHEDULE: 'Reschedule notice' }[kind];
}
