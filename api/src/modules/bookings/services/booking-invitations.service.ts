import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BookingInvitationStatus, BookingInviteTemplateKind, BookingStatus, InteractionType, MessageTemplate, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BOOKING_NOTIFICATION_QUEUE } from '@/core/queues/queues.constants';
import { MessageSendService } from '@/modules/outreach/services/message-send.service';
import { OutreachRenderService } from '@/modules/outreach/services/outreach-render.service';
import { BookingLinksService, bookingLinkHtml } from '@/modules/booking-links/booking-links.service';
import { renderPlaceholders } from '@/shared/utils/placeholder-render.util';
import { BookingJobNames, NOTIFICATION_SEND_ATTEMPTS } from '../constants/booking.constants';
import {
    DEFAULT_INVITE_REMINDER_SETTINGS,
    DEFAULT_INVITE_TEXT,
    defaultInviteText,
    INVITE_UNIT_MINUTES,
    MAX_INVITE_DELAY_MINUTES,
} from '../constants/booking-invitation-templates';
import { BookingActor, BookingInviteReminderJobData } from '../interfaces/booking.interface';
import {
    SendBookingInvitationDto,
    UpdateBookingInviteSettingsDto,
} from '../dto/booking-invitation.dto';
import { escapeHtml, escapeVars } from '../utils/booking-template-vars.util';
import { pickTemplateForLanguage, resolveRecipientLanguage } from '../utils/booking-template-language.util';

type InviteKind = 'invite' | 'reminder';

interface ComposeInput {
    kind: InviteKind;
    settings: { invite_subject: string | null; invite_message: string | null; reminder_subject: string | null; reminder_message: string | null };
    contact: { name: string | null; country: string | null };
    /** Message templates the organisation offers for this email kind; the one in the contact's language is used. */
    templates: MessageTemplate[];
    /** Team member the email is sent as: their sender profile supplies {{signature}}. */
    sender_user_uuid: string | null;
    organisation_uuid: string;
    page: { name: string; title: string | null; brand_name: string | null; cta_label: string | null; primary_color: string | null };
    sender: { full_name: string | null; email: string } | null;
    organisation_name: string;
    url: string;
}

/**
 * Emails a contact their personal booking link and, when nothing has been booked after the
 * organisation's configured delay, follows up with reminders.
 */
@Injectable()
export class BookingInvitationsService {
    private readonly logger = new Logger(BookingInvitationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly messageSendService: MessageSendService,
        private readonly bookingLinksService: BookingLinksService,
        private readonly outreachRenderService: OutreachRenderService,
        @InjectQueue(BOOKING_NOTIFICATION_QUEUE) private readonly queue: Queue<BookingInviteReminderJobData>,
    ) {}

    // --- Central settings -------------------------------------------------------------------

    async getSettings(organisation_uuid: string) {
        const [row, templateRows] = await Promise.all([
            this.prisma.bookingInviteSettings.findUnique({ where: { organisation_uuid } }),
            this.prisma.bookingInviteTemplate.findMany({ where: { organisation_uuid }, orderBy: { created_at: 'asc' }, select: { kind: true, template_uuid: true } }),
        ]);
        const templateUuids = (kind: BookingInviteTemplateKind) => templateRows.filter((r) => r.kind === kind).map((r) => r.template_uuid);
        return {
            reminder_enabled: row?.reminder_enabled ?? DEFAULT_INVITE_REMINDER_SETTINGS.reminder_enabled,
            reminder_delay_value: row?.reminder_delay_value ?? DEFAULT_INVITE_REMINDER_SETTINGS.reminder_delay_value,
            reminder_delay_unit: row?.reminder_delay_unit ?? DEFAULT_INVITE_REMINDER_SETTINGS.reminder_delay_unit,
            max_reminders: row?.max_reminders ?? DEFAULT_INVITE_REMINDER_SETTINGS.max_reminders,
            invite_subject: row?.invite_subject ?? null,
            invite_message: row?.invite_message ?? null,
            reminder_subject: row?.reminder_subject ?? null,
            reminder_message: row?.reminder_message ?? null,
            invite_template_uuids: templateUuids(BookingInviteTemplateKind.INVITE),
            reminder_template_uuids: templateUuids(BookingInviteTemplateKind.REMINDER),
            defaults: DEFAULT_INVITE_TEXT,
        };
    }

    async updateSettings(organisation_uuid: string, dto: UpdateBookingInviteSettingsDto) {
        const current = await this.getSettings(organisation_uuid);
        const value = dto.reminder_delay_value ?? current.reminder_delay_value;
        const unit = dto.reminder_delay_unit ?? current.reminder_delay_unit;
        if (value * INVITE_UNIT_MINUTES[unit] > MAX_INVITE_DELAY_MINUTES) {
            throw new BadRequestException('The reminder delay can be at most 90 days');
        }
        const text = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
        const data = {
            ...(dto.reminder_enabled !== undefined && { reminder_enabled: dto.reminder_enabled }),
            reminder_delay_value: value,
            reminder_delay_unit: unit,
            ...(dto.max_reminders !== undefined && { max_reminders: dto.max_reminders }),
            invite_subject: text(dto.invite_subject),
            invite_message: text(dto.invite_message),
            reminder_subject: text(dto.reminder_subject),
            reminder_message: text(dto.reminder_message),
        };
        const templates = {
            [BookingInviteTemplateKind.INVITE]: dto.invite_template_uuids,
            [BookingInviteTemplateKind.REMINDER]: dto.reminder_template_uuids,
        };
        await this.assertTemplates(organisation_uuid, templates);
        await this.prisma.$transaction(async (tx) => {
            await tx.bookingInviteSettings.upsert({
                where: { organisation_uuid },
                create: { organisation_uuid, ...data },
                update: data,
            });
            await this.replaceTemplates(tx, organisation_uuid, templates);
        });
        return this.getSettings(organisation_uuid);
    }

    // --- Sending ----------------------------------------------------------------------------

    async send(actor: BookingActor, dto: SendBookingInvitationDto) {
        const { organisation_uuid } = actor;
        const contact = await this.prisma.contact.findFirst({
            where: { uuid: dto.contact_uuid, organisation_uuid },
            select: { uuid: true, name: true, email: true, country: true, unsubscribed_at: true, bounced_at: true },
        });
        if (!contact) throw new NotFoundException('Contact not found');
        if (!contact.email) throw new BadRequestException('This contact has no email address');
        if (contact.unsubscribed_at) throw new BadRequestException('This contact has unsubscribed from emails');
        if (contact.bounced_at) throw new BadRequestException('Emails to this contact bounced earlier');

        const { link, page } = await this.resolveLink(organisation_uuid, dto);
        const settings = await this.getSettings(organisation_uuid);
        const remind = (dto.remind ?? settings.reminder_enabled) && settings.max_reminders > 0;
        const delayMinutes = settings.reminder_delay_value * INVITE_UNIT_MINUTES[settings.reminder_delay_unit];

        const [sender, organisation] = await Promise.all([
            this.prisma.user.findUnique({ where: { uuid: actor.uuid }, select: { full_name: true, email: true } }),
            this.prisma.organisation.findUnique({ where: { uuid: organisation_uuid }, select: { name: true } }),
        ]);
        const { subject, html } = await this.compose({
            kind: 'invite',
            settings,
            contact,
            templates: await this.templatesFor(organisation_uuid, BookingInviteTemplateKind.INVITE),
            sender_user_uuid: actor.uuid,
            organisation_uuid,
            page,
            sender,
            organisation_name: organisation?.name ?? '',
            url: this.bookingLinksService.publicUrl(link.code),
        });
        try {
            await this.messageSendService.sendTransactionalEmail(organisation_uuid, {
                to: contact.email,
                subject,
                html,
                replyTo: sender?.email ?? null,
            });
        } catch (error) {
            this.logger.warn(`Booking invitation to contact ${contact.uuid} failed: ${(error as Error).message}`);
            throw new BadRequestException(`The email could not be sent: ${(error as Error).message}`);
        }

        // A newer invitation for the same link replaces the reminders of the older one.
        await this.stopActiveForLink(link.uuid);

        const invitation = await this.prisma.bookingInvitation.create({
            data: {
                organisation_uuid,
                booking_page_uuid: page.uuid,
                booking_link_uuid: link.uuid,
                contact_uuid: contact.uuid,
                sent_by_user_uuid: actor.uuid,
                recipient_email: contact.email,
                reminder_enabled: remind,
                reminder_delay_minutes: remind ? delayMinutes : 0,
                max_reminders: remind ? settings.max_reminders : 0,
                next_reminder_at: remind ? new Date(Date.now() + delayMinutes * 60_000) : null,
            },
        });
        if (remind) await this.scheduleReminder(invitation.uuid, 1, delayMinutes);
        await this.logInteraction(invitation, InteractionType.BOOKING_LINK_SENT, `Booking link for "${page.title || page.name}" emailed to ${contact.email}`, {
            reminders_planned: invitation.max_reminders,
        });
        return this.present(invitation, link.code, page.name, false);
    }

    /** Emails the same link again as a fresh invitation, so its reminder sequence starts over. */
    async resend(actor: BookingActor, uuid: string) {
        const invitation = await this.prisma.bookingInvitation.findFirst({
            where: { uuid, organisation_uuid: actor.organisation_uuid },
            select: { contact_uuid: true, booking_link_uuid: true, reminder_enabled: true },
        });
        if (!invitation) throw new NotFoundException('Invitation not found');
        return this.send(actor, {
            contact_uuid: invitation.contact_uuid,
            booking_link_uuid: invitation.booking_link_uuid,
            remind: invitation.reminder_enabled,
        });
    }

    async findForContact(organisation_uuid: string, contact_uuid: string) {
        const invitations = await this.prisma.bookingInvitation.findMany({
            where: { organisation_uuid, contact_uuid },
            orderBy: { sent_at: 'desc' },
            take: 50,
            include: {
                booking_link: { select: { code: true } },
                booking_page: { select: { name: true } },
            },
        });
        const results = [];
        for (const invitation of invitations) {
            const booked = await this.hasBooked(invitation);
            results.push(this.present(invitation, invitation.booking_link.code, invitation.booking_page.name, booked));
        }
        return results;
    }

    async stop(organisation_uuid: string, uuid: string) {
        const invitation = await this.prisma.bookingInvitation.findFirst({ where: { uuid, organisation_uuid } });
        if (!invitation) throw new NotFoundException('Invitation not found');
        await this.end(invitation, BookingInvitationStatus.STOPPED);
        return { success: true };
    }

    // --- Reminders (worker) -----------------------------------------------------------------

    /** Sends one follow-up unless the contact booked in the meantime or can no longer be emailed. */
    async processReminder(job: BookingInviteReminderJobData): Promise<void> {
        const invitation = await this.prisma.bookingInvitation.findUnique({
            where: { uuid: job.invitation_uuid },
            include: {
                booking_link: { select: { code: true, is_active: true } },
                booking_page: {
                    select: { uuid: true, name: true, title: true, brand_name: true, cta_label: true, primary_color: true, is_active: true },
                },
                contact: { select: { name: true, email: true, country: true, unsubscribed_at: true, bounced_at: true } },
            },
        });
        if (!invitation || invitation.status !== BookingInvitationStatus.ACTIVE) return;
        // A retried or duplicated job for a reminder that already went out.
        if (invitation.reminders_sent >= job.reminder_number) return;
        if (invitation.reminders_sent >= invitation.max_reminders) {
            await this.end(invitation, BookingInvitationStatus.STOPPED);
            return;
        }

        if (await this.hasBooked(invitation)) {
            await this.end(invitation, BookingInvitationStatus.BOOKED);
            return;
        }
        const { contact, booking_link: link, booking_page: page } = invitation;
        if (!link.is_active || !page.is_active || !contact.email || contact.unsubscribed_at || contact.bounced_at) {
            await this.end(invitation, BookingInvitationStatus.STOPPED);
            return;
        }

        const [settings, sender, organisation] = await Promise.all([
            this.getSettings(invitation.organisation_uuid),
            invitation.sent_by_user_uuid
                ? this.prisma.user.findUnique({ where: { uuid: invitation.sent_by_user_uuid }, select: { full_name: true, email: true } })
                : null,
            this.prisma.organisation.findUnique({ where: { uuid: invitation.organisation_uuid }, select: { name: true } }),
        ]);
        const { subject, html } = await this.compose({
            kind: 'reminder',
            settings,
            contact,
            templates: await this.templatesFor(invitation.organisation_uuid, BookingInviteTemplateKind.REMINDER),
            sender_user_uuid: invitation.sent_by_user_uuid,
            organisation_uuid: invitation.organisation_uuid,
            page,
            sender,
            organisation_name: organisation?.name ?? '',
            url: this.bookingLinksService.publicUrl(link.code),
        });
        try {
            await this.messageSendService.sendTransactionalEmail(invitation.organisation_uuid, {
                to: contact.email,
                subject,
                html,
                replyTo: sender?.email ?? null,
            });
        } catch (error) {
            await this.prisma.bookingInvitation.update({
                where: { uuid: invitation.uuid },
                data: { last_error: (error as Error).message },
            });
            throw error; // BullMQ retries
        }

        const sent = invitation.reminders_sent + 1;
        const more = sent < invitation.max_reminders;
        await this.prisma.bookingInvitation.update({
            where: { uuid: invitation.uuid },
            data: {
                reminders_sent: sent,
                last_error: null,
                status: more ? BookingInvitationStatus.ACTIVE : BookingInvitationStatus.STOPPED,
                next_reminder_at: more ? new Date(Date.now() + invitation.reminder_delay_minutes * 60_000) : null,
            },
        });
        if (more) await this.scheduleReminder(invitation.uuid, sent + 1, invitation.reminder_delay_minutes);
        await this.logInteraction(
            invitation,
            InteractionType.BOOKING_REMINDER_SENT,
            `Reminder ${sent} of ${invitation.max_reminders} for "${page.title || page.name}" emailed to ${contact.email}`,
            { reminder_number: sent },
        );
    }

    /** Puts the email on the contact's timeline. Never fails the send: the email already went out. */
    private async logInteraction(
        invitation: {
            uuid: string;
            organisation_uuid: string;
            contact_uuid: string;
            booking_page_uuid: string;
            booking_link_uuid: string;
            sent_by_user_uuid: string | null;
        },
        type: InteractionType,
        content: string,
        extra: Record<string, unknown>,
    ) {
        try {
            await this.prisma.interaction.create({
                data: {
                    contact_uuid: invitation.contact_uuid,
                    organisation_uuid: invitation.organisation_uuid,
                    type,
                    content,
                    metadata: {
                        booking_invitation_uuid: invitation.uuid,
                        booking_link_uuid: invitation.booking_link_uuid,
                        booking_page_uuid: invitation.booking_page_uuid,
                        ...extra,
                    } as Prisma.InputJsonValue,
                    created_by_user_uuid: invitation.sent_by_user_uuid,
                },
            });
            await this.prisma.contact.update({
                where: { uuid: invitation.contact_uuid },
                data: { last_interaction_at: new Date() },
            });
        } catch (error) {
            this.logger.warn(`Could not log ${type} for contact ${invitation.contact_uuid}: ${(error as Error).message}`);
        }
    }

    // --- Internals --------------------------------------------------------------------------

    private async resolveLink(organisation_uuid: string, dto: SendBookingInvitationDto) {
        const pageSelect = { uuid: true, name: true, title: true, brand_name: true, cta_label: true, primary_color: true, is_active: true } as const;

        if (dto.booking_link_uuid) {
            const link = await this.prisma.bookingLink.findFirst({
                where: { uuid: dto.booking_link_uuid, organisation_uuid, contact_uuid: dto.contact_uuid },
                include: { booking_page: { select: pageSelect } },
            });
            if (!link) throw new NotFoundException('Booking link not found for this contact');
            if (!link.is_active) throw new BadRequestException('This booking link is inactive');
            if (!link.booking_page.is_active) throw new BadRequestException('The booking page is inactive');
            return { link, page: link.booking_page };
        }

        if (!dto.booking_page_uuid) throw new BadRequestException('Pick a booking page');
        const page = await this.prisma.bookingPage.findFirst({
            where: { uuid: dto.booking_page_uuid, organisation_uuid },
            select: pageSelect,
        });
        if (!page) throw new NotFoundException('Booking page not found');
        if (!page.is_active) throw new BadRequestException('The booking page is inactive');
        const link = await this.bookingLinksService.getOrCreateContactLink(organisation_uuid, page.uuid, dto.contact_uuid);
        return { link, page };
    }

    /** True when the contact booked this page after the invitation went out (cancelled bookings don't count). */
    private async hasBooked(invitation: {
        organisation_uuid: string;
        contact_uuid: string;
        booking_page_uuid: string;
        booking_link_uuid: string;
        sent_at: Date;
    }): Promise<boolean> {
        const booking = await this.prisma.booking.findFirst({
            where: {
                organisation_uuid: invitation.organisation_uuid,
                created_at: { gte: invitation.sent_at },
                status: { not: BookingStatus.CANCELLED },
                OR: [
                    { booking_link_uuid: invitation.booking_link_uuid },
                    { contact_uuid: invitation.contact_uuid, booking_page_uuid: invitation.booking_page_uuid },
                ],
            },
            select: { uuid: true },
        });
        return !!booking;
    }

    private async scheduleReminder(invitation_uuid: string, reminder_number: number, delayMinutes: number) {
        await this.queue.add(
            BookingJobNames.INVITE_REMINDER,
            { invitation_uuid, reminder_number },
            {
                jobId: this.jobId(invitation_uuid, reminder_number),
                delay: delayMinutes * 60_000,
                attempts: NOTIFICATION_SEND_ATTEMPTS,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 7 * 86400 },
            },
        );
    }

    private async end(
        invitation: { uuid: string; reminders_sent: number; max_reminders: number },
        status: BookingInvitationStatus,
    ) {
        await this.prisma.bookingInvitation.update({
            where: { uuid: invitation.uuid },
            data: { status, next_reminder_at: null },
        });
        for (let n = invitation.reminders_sent + 1; n <= invitation.max_reminders; n++) {
            try {
                const job = await this.queue.getJob(this.jobId(invitation.uuid, n));
                if (job && !(await job.isActive())) await job.remove();
            } catch {
                // Already processed or removed - the worker skips non-active invitations anyway.
            }
        }
    }

    private async stopActiveForLink(booking_link_uuid: string) {
        const active = await this.prisma.bookingInvitation.findMany({
            where: { booking_link_uuid, status: BookingInvitationStatus.ACTIVE },
            select: { uuid: true, reminders_sent: true, max_reminders: true },
        });
        for (const invitation of active) await this.end(invitation, BookingInvitationStatus.STOPPED);
    }

    /** Message templates the organisation offers for one kind of booking-link email (email-capable ones only). */
    private async templatesFor(organisation_uuid: string, kind: BookingInviteTemplateKind): Promise<MessageTemplate[]> {
        const rows = await this.prisma.bookingInviteTemplate.findMany({
            where: { organisation_uuid, kind },
            orderBy: { created_at: 'asc' },
            include: { template: true },
        });
        return rows.map((r) => r.template).filter((t) => !!t.email_content?.trim());
    }

    private async assertTemplates(
        organisation_uuid: string,
        templates: Partial<Record<BookingInviteTemplateKind, string[] | undefined>>,
    ) {
        const unique = [...new Set(Object.values(templates).flat().filter(Boolean) as string[])];
        if (!unique.length) return;
        const count = await this.prisma.messageTemplate.count({
            where: { organisation_uuid, uuid: { in: unique }, channels: { has: 'EMAIL' } },
        });
        if (count !== unique.length) throw new BadRequestException('Email template not found');
    }

    private async replaceTemplates(
        tx: Prisma.TransactionClient,
        organisation_uuid: string,
        templates: Partial<Record<BookingInviteTemplateKind, string[] | undefined>>,
    ) {
        for (const [kind, uuids] of Object.entries(templates) as Array<[BookingInviteTemplateKind, string[] | undefined]>) {
            if (!uuids) continue;
            const unique = [...new Set(uuids)];
            await tx.bookingInviteTemplate.deleteMany({ where: { organisation_uuid, kind, template_uuid: { notIn: unique } } });
            if (unique.length) {
                await tx.bookingInviteTemplate.createMany({
                    data: unique.map((template_uuid) => ({ organisation_uuid, kind, template_uuid })),
                    skipDuplicates: true,
                });
            }
        }
    }

    /**
     * Content in order of preference: the organisation's message template in the contact's language (HTML), else its
     * own plain text from the invite settings, else the built-in default in that language.
     */
    private async compose(input: ComposeInput): Promise<{ subject: string; html: string }> {
        const { kind, settings, contact, page, sender, url } = input;
        const language = resolveRecipientLanguage({ contact_country: contact.country });
        const template = pickTemplateForLanguage(input.templates, language);
        const defaults = defaultInviteText(language);
        const subjectTemplate =
            template?.email_subject?.trim() ||
            (kind === 'invite' ? settings.invite_subject : settings.reminder_subject) ||
            defaults[kind === 'invite' ? 'invite_subject' : 'reminder_subject'];

        const fullName = contact.name?.trim() ?? '';
        const team = await this.outreachRenderService.buildVarsForTeamMember(input.organisation_uuid, input.sender_user_uuid);
        const senderName = sender?.full_name || sender?.email || '';
        const vars: Record<string, string> = {
            ...team,
            'contact.first_name': fullName.split(/\s+/)[0] || (language === 'el' ? '' : 'there'),
            'contact.full_name': fullName,
            'booking.title': page.title || page.name,
            'brand.name': page.brand_name?.trim() ?? '',
            'sender.name': senderName,
            'organisation.name': input.organisation_name,
            booking_link: url,
        };
        // The sender profile's signature is org-authored HTML, so it is not escaped; without one it falls back to a
        // plain sign-off rather than leaving a gap.
        const signature = vars.signature?.trim() || this.fallbackSignature(senderName, vars['brand.name']);
        // A plain link worded in the email's language (not the page's single-language button label).
        const linkLabel = (template?.language ?? language) === 'el' ? 'Επιλέξτε ώρα που σας βολεύει' : 'Pick a time that suits you';
        const raw = { signature, booking_button: bookingLinkHtml(url, linkLabel) };

        const messageTemplate =
            template?.email_content ||
            (kind === 'invite' ? settings.invite_message : settings.reminder_message) ||
            defaults[kind === 'invite' ? 'invite_message' : 'reminder_message'];
        const hasLink = /\{\{\s*booking_(link|button)\s*\}\}/.test(messageTemplate);

        // Message templates are already HTML; plain text from the settings is turned into paragraphs.
        const body = template?.email_content
            ? messageTemplate
            : this.plainTextToHtml(hasLink ? messageTemplate : `${messageTemplate}\n\n{{booking_button}}`);
        let html = renderPlaceholders(body, { ...escapeVars(vars), ...raw });
        if (template?.email_content && !hasLink) html += raw.booking_button;
        return { subject: renderPlaceholders(subjectTemplate, vars), html };
    }

    private plainTextToHtml(text: string): string {
        return text
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph) =>
                // The button and signature are HTML blocks of their own.
                /^\{\{\s*(booking_button|signature)\s*\}\}$/.test(paragraph)
                    ? paragraph
                    : `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
            )
            .join('');
    }

    private fallbackSignature(name: string, brand: string): string {
        const lines = [name, brand].map((v) => v.trim()).filter(Boolean);
        return lines.length ? `<p>${lines.map((l) => escapeHtml(l)).join('<br>')}</p>` : '';
    }

    private present(
        invitation: {
            uuid: string;
            status: BookingInvitationStatus;
            recipient_email: string;
            sent_at: Date;
            reminder_enabled: boolean;
            reminders_sent: number;
            max_reminders: number;
            next_reminder_at: Date | null;
            last_error: string | null;
            booking_page_uuid: string;
            booking_link_uuid: string;
        },
        code: string,
        page_name: string,
        has_booked: boolean,
    ) {
        return {
            uuid: invitation.uuid,
            status: has_booked ? BookingInvitationStatus.BOOKED : invitation.status,
            recipient_email: invitation.recipient_email,
            sent_at: invitation.sent_at,
            reminder_enabled: invitation.reminder_enabled,
            reminders_sent: invitation.reminders_sent,
            max_reminders: invitation.max_reminders,
            next_reminder_at: has_booked ? null : invitation.next_reminder_at,
            last_error: invitation.last_error,
            booking_page: { uuid: invitation.booking_page_uuid, name: page_name },
            booking_link: { uuid: invitation.booking_link_uuid, url: this.bookingLinksService.publicUrl(code) },
            has_booked,
        };
    }

    private jobId(invitation_uuid: string, reminder_number: number) {
        return `booking-invite-reminder-${invitation_uuid}-${reminder_number}`;
    }
}
