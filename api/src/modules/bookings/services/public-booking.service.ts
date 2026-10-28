import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    Booking,
    BookingEventType,
    BookingLocationType,
    BookingSource,
    BookingStatus,
    BookingUnavailableSlotsMode,
    Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { BookingPublicUrls } from '@/modules/booking-links/utils/booking-url.util';
import { BookingsService } from '../bookings.service';
import { BookingSlotService } from './booking-slot.service';
import { BookingEventsService, INVITEE_ACTOR } from './booking-events.service';
import { ACTIVE_BOOKING_STATUSES, BookingErrorCodes } from '../constants/booking.constants';
import { BookingSlotsQueryDto } from '../dto/booking-slots-query.dto';
import { PublicCancelBookingDto, PublicCreateBookingDto, PublicRescheduleBookingDto } from '../dto/public-booking.dto';
import { BookingQuestionDto } from '../dto/create-booking-page.dto';
import { isValidTimeZone } from '../utils/slot-calculation.util';

const LINK_INCLUDE = {
    booking_page: true,
    organisation: { select: { name: true, timezone: true } },
    contact: { select: { uuid: true, name: true, email: true, phone: true } },
} satisfies Prisma.BookingLinkInclude;

type PublicLink = Prisma.BookingLinkGetPayload<{ include: typeof LINK_INCLUDE }>;

/** A public page is addressed either by a link's short code or, for the general page URL, by organisation and page slug. */
export type PublicPageRef = { code: string } | { organisation_slug: string; page_slug: string };

/** What a public ref resolves to. Slug refs have no link (and so no contact). */
interface PublicTarget {
    page: PublicLink['booking_page'];
    organisation: PublicLink['organisation'];
    organisation_uuid: string;
    link: PublicLink | null;
    contact: PublicLink['contact'];
}

const MANAGE_INCLUDE = {
    booking_page: true,
    organisation: { select: { name: true, timezone: true } },
    assigned_user: { select: { full_name: true } },
} satisfies Prisma.BookingInclude;

type ManagedBooking = Prisma.BookingGetPayload<{ include: typeof MANAGE_INCLUDE }>;

/**
 * Everything reachable without logging in. Responses expose only what an invitee needs to book:
 * no database ids of contacts, no team emails, no internal notes.
 */
@Injectable()
export class PublicBookingService {
    private readonly logger = new Logger(PublicBookingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly bookingsService: BookingsService,
        private readonly slotService: BookingSlotService,
        private readonly contactsService: ContactsService,
        private readonly events: BookingEventsService,
    ) {}

    async getPage(ref: PublicPageRef, visitor?: { user_agent?: string; referrer?: string }) {
        const { page, organisation, link, contact } = await this.resolve(ref);
        if (link) await this.recordVisit(link.uuid, visitor);
        const members = page.show_team_member || page.allow_invitee_member_choice
            ? await this.slotService.eligibleMembers(this.prisma, page)
            : [];

        return {
            code: link?.code ?? null,
            default_timezone: organisation.timezone,
            page: {
                title: page.title || page.name,
                description: page.description,
                intro_text: page.intro_text,
                expectations: page.expectations,
                brand_name: page.brand_name?.trim() || '',
                logo_url: page.logo_url,
                primary_color: page.primary_color,
                show_timezone: page.show_timezone,
                durations: this.slotService.allowedDurations(page),
                default_duration: page.duration_minutes,
                max_advance_days: page.max_advance_days,
                location_type: page.location_type,
                // Addresses are needed by invitees; phone/custom details are shared after booking.
                location_details: page.location_type === BookingLocationType.IN_PERSON ? page.location_value : null,
                questions: (page.questions as unknown as BookingQuestionDto[] | null) ?? [],
                require_phone: page.require_phone,
                requires_confirmation: page.requires_confirmation,
                team: page.show_team_member ? members.map((m) => ({ name: displayName(m.user) })) : [],
                allow_member_choice: page.allow_invitee_member_choice,
                members: page.allow_invitee_member_choice ? members.map((m) => ({ uuid: m.user.uuid, name: displayName(m.user) })) : [],
            },
            // Contact links greet the invitee; only a masked email is revealed to whoever holds the URL.
            invitee: contact ? { name: contact.name ?? '', email_hint: maskEmail(contact.email) } : null,
        };
    }

    async getSlots(ref: PublicPageRef, query: BookingSlotsQueryDto) {
        const { page } = await this.resolve(ref);
        return this.slotsFor(page, query, null);
    }

    async book(ref: PublicPageRef, dto: PublicCreateBookingDto) {
        const { page, organisation, organisation_uuid, link, contact } = await this.resolve(ref);
        const answers = this.validateAnswers(page.questions as unknown as BookingQuestionDto[] | null, dto.answers);
        if (page.require_phone && !dto.phone?.trim()) throw new BadRequestException('A phone number is required');

        const email = dto.email?.trim() || contact?.email;
        if (!email) throw new BadRequestException('An email address is required');

        const start = new Date(dto.start_at);
        const duration = dto.duration_minutes ?? page.duration_minutes;
        let candidates: string[];
        if (page.allow_invitee_member_choice && dto.member_uuid) {
            const eligible = await this.slotService.eligibleMembers(this.prisma, page);
            if (!eligible.some((m) => m.user_uuid === dto.member_uuid)) throw new BadRequestException('Unknown team member');
            candidates = [dto.member_uuid];
        } else {
            // Assignment is internal: invitees never choose who they meet unless the page allows it.
            const eligible = (await this.slotService.eligibleMembers(this.prisma, page)).map((m) => m.user_uuid);
            candidates = await this.slotService.rankCandidates(page, eligible, start);
        }

        const booking = await this.bookingsService.placeBooking({
            organisation_uuid,
            page,
            start,
            duration_minutes: duration,
            candidates,
            ignore_availability: false,
            source: BookingSource.PUBLIC,
            status: page.requires_confirmation ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
            booking_link_uuid: link?.uuid ?? null,
            contact_uuid: contact?.uuid ?? null,
            invitee: {
                name: dto.name.trim(),
                email,
                phone: dto.phone?.trim() || null,
                company: dto.company?.trim() || null,
                notes: dto.notes?.trim() || null,
                timezone: isValidTimeZone(dto.timezone) ? dto.timezone : null,
            },
            location_type: page.location_type,
            location_value: page.location_value,
            answers,
            actor: INVITEE_ACTOR,
        });

        // Contact creation happens only once the slot is secured, so failed attempts leave no contacts behind.
        const withContact = await this.attachContact(link, organisation_uuid, booking, dto);
        await this.fillContactCompany(withContact.contact_uuid, dto.company);
        await this.bookingsService.afterCreate(withContact, { notify: true });
        const assigned_user = withContact.assigned_user_uuid
            ? await this.prisma.user.findUnique({ where: { uuid: withContact.assigned_user_uuid }, select: { full_name: true } })
            : null;
        return {
            booking: this.publicSummary({ ...withContact, booking_page: page, organisation, assigned_user }),
            manage_url: BookingPublicUrls.manage(this.appUrl(), withContact.manage_token),
            confirmation_message: page.confirmation_message,
            redirect_url: page.redirect_url,
        };
    }

    async getManage(token: string) {
        const booking = await this.findByToken(token);
        return { booking: this.publicSummary(booking), policy: this.policy(booking) };
    }

    async getManageSlots(token: string, query: BookingSlotsQueryDto) {
        const booking = await this.findByToken(token);
        if (!this.policy(booking).can_reschedule || !booking.booking_page) {
            throw new ForbiddenException('This booking can no longer be rescheduled online');
        }
        return this.slotsFor(booking.booking_page, { ...query, duration: booking.duration_minutes }, booking.uuid);
    }

    async cancel(token: string, dto: PublicCancelBookingDto) {
        const booking = await this.findByToken(token);
        const policy = this.policy(booking);
        if (!policy.can_cancel) {
            throw new ForbiddenException({ message: policy.reason ?? 'This booking can no longer be cancelled online', code: BookingErrorCodes.DEADLINE_PASSED });
        }
        if (policy.require_cancellation_reason && !dto.reason?.trim()) throw new BadRequestException('Please tell us why you are cancelling');
        await this.bookingsService.cancelBooking(booking, { reason: dto.reason?.trim() || null, notify: true, actor: INVITEE_ACTOR });
        return this.getManage(token);
    }

    async reschedule(token: string, dto: PublicRescheduleBookingDto) {
        const booking = await this.findByToken(token);
        const policy = this.policy(booking);
        if (!policy.can_reschedule) {
            throw new ForbiddenException({ message: policy.reason ?? 'This booking can no longer be rescheduled online', code: BookingErrorCodes.DEADLINE_PASSED });
        }
        await this.bookingsService.moveBooking(booking, new Date(dto.start_at), {
            ignore_availability: false,
            notify: true,
            actor: INVITEE_ACTOR,
        });
        if (dto.timezone && isValidTimeZone(dto.timezone) && dto.timezone !== booking.invitee_timezone) {
            await this.prisma.booking.update({ where: { uuid: booking.uuid }, data: { invitee_timezone: dto.timezone } });
        }
        return this.getManage(token);
    }

    private async slotsFor(page: PublicLink['booking_page'], query: BookingSlotsQueryDto, exclude_booking_uuid: string | null) {
        const range = this.slotService.parseRange(query.from, query.to);
        const duration = query.duration ?? page.duration_minutes;
        const slots = await this.slotService.getSlots(page, range, {
            duration,
            member_uuid: page.allow_invitee_member_choice ? query.member_uuid : undefined,
            exclude_booking_uuid,
            // Decided by the page setting only - visitors can't ask for more than the page chooses to show.
            include_unavailable: page.unavailable_slots_mode === BookingUnavailableSlotsMode.SHOW_DISABLED,
        });
        return this.slotService.groupByDate(slots, query.timezone ?? 'UTC', duration, false);
    }

    /** Generic links can create (or match, by email) a contact; contact links already point at one. */
    private async attachContact(
        link: PublicLink | null,
        organisation_uuid: string,
        booking: Booking,
        dto: PublicCreateBookingDto,
    ): Promise<Booking> {
        if (booking.contact_uuid || !link?.auto_create_contact) return booking;
        try {
            const contact = await this.contactsService.create(organisation_uuid, {
                name: dto.name.trim(),
                email: booking.invitee_email,
                ...(dto.phone?.trim() && { phone: dto.phone.trim() }),
                ...(dto.company?.trim() && { company: dto.company.trim() }),
            });
            const updated = await this.prisma.booking.update({ where: { uuid: booking.uuid }, data: { contact_uuid: contact.uuid } });
            await this.events.record(booking, BookingEventType.UPDATED, INVITEE_ACTOR, 'Linked to contact', { contact_uuid: contact.uuid });
            return updated;
        } catch (error) {
            // The booking stands on its own (invitee details are on it); a contact can be linked later.
            this.logger.warn(`Could not create contact for booking ${booking.uuid}: ${(error as Error).message}`);
            return booking;
        }
    }

    /** Saves the company on the linked contact, never overwriting one that is already set. */
    private async fillContactCompany(contact_uuid: string | null, company: string | undefined): Promise<void> {
        const value = company?.trim();
        if (!contact_uuid || !value) return;
        try {
            await this.prisma.contact.updateMany({
                where: { uuid: contact_uuid, OR: [{ company: null }, { company: '' }] },
                data: { company: value },
            });
        } catch (error) {
            this.logger.warn(`Could not save company on contact ${contact_uuid}: ${(error as Error).message}`);
        }
    }

    private validateAnswers(questions: BookingQuestionDto[] | null, answers: Record<string, unknown> | undefined) {
        const result: Record<string, string | boolean> = {};
        for (const question of questions ?? []) {
            const raw = answers?.[question.id];
            if (question.type === 'CHECKBOX') {
                const checked = raw === true || raw === 'true';
                if (question.required && !checked) throw new BadRequestException(`"${question.label}" must be checked`);
                result[question.id] = checked;
                continue;
            }
            const value = typeof raw === 'string' ? raw.trim().slice(0, 2000) : '';
            if (question.required && !value) throw new BadRequestException(`"${question.label}" is required`);
            if (value && question.type === 'SELECT' && !question.options?.includes(value)) {
                throw new BadRequestException(`Pick one of the options for "${question.label}"`);
            }
            if (value) result[question.id] = value;
        }
        return result;
    }

    private policy(booking: ManagedBooking) {
        const page = booking.booking_page;
        const active = ACTIVE_BOOKING_STATUSES.includes(booking.status) && booking.start_at > new Date();
        const minutesLeft = (booking.start_at.getTime() - Date.now()) / 60_000;
        const canCancel = active && (page?.allow_cancellation ?? true) && minutesLeft >= (page?.cancellation_deadline_minutes ?? 0);
        const canReschedule = active && !!page && page.allow_reschedule && minutesLeft >= page.reschedule_deadline_minutes;
        return {
            can_cancel: canCancel,
            can_reschedule: canReschedule,
            require_cancellation_reason: page?.require_cancellation_reason ?? false,
            // Lets the reschedule picker mirror the booking page (date limit, timezone selector).
            max_advance_days: page?.max_advance_days ?? null,
            show_timezone: page?.show_timezone ?? true,
            cancellation_deadline_minutes: page?.cancellation_deadline_minutes ?? 0,
            reschedule_deadline_minutes: page?.reschedule_deadline_minutes ?? 0,
            reason: !active
                ? booking.status === BookingStatus.CANCELLED
                    ? 'This booking was cancelled'
                    : 'This booking has already taken place'
                : !canCancel && !canReschedule
                  ? 'Changes are no longer possible online - please contact us directly'
                  : null,
        };
    }

    private publicSummary(booking: Booking & Partial<Pick<ManagedBooking, 'booking_page' | 'organisation' | 'assigned_user'>>) {
        const page = booking.booking_page;
        const revealLocation = booking.status !== BookingStatus.CANCELLED;
        return {
            status: booking.status,
            title: page?.title || page?.name || 'Meeting',
            brand_name: page?.brand_name?.trim() || null,
            start_at: booking.start_at,
            end_at: booking.end_at,
            duration_minutes: booking.duration_minutes,
            timezone: booking.invitee_timezone ?? booking.organisation?.timezone ?? 'UTC',
            invitee_name: booking.invitee_name,
            team_member: page?.show_team_member && booking.assigned_user ? displayName(booking.assigned_user) : null,
            location_type: booking.location_type,
            location_details: revealLocation ? booking.location_value : null,
            meeting_url: revealLocation ? booking.meeting_url : null,
            primary_color: page?.primary_color ?? null,
            logo_url: page?.logo_url ?? null,
        };
    }

    /** Visit tracking is best-effort: it must never stop an invitee from seeing the page. */
    private async recordVisit(booking_link_uuid: string, visitor?: { user_agent?: string; referrer?: string }) {
        try {
            const now = new Date();
            await this.prisma.$transaction([
                this.prisma.bookingLinkVisit.create({
                    data: {
                        booking_link_uuid,
                        user_agent: visitor?.user_agent?.slice(0, 512) || null,
                        referrer: visitor?.referrer?.slice(0, 512) || null,
                    },
                }),
                this.prisma.bookingLink.update({ where: { uuid: booking_link_uuid }, data: { last_visited_at: now } }),
            ]);
        } catch (error) {
            this.logger.warn(`Failed to record visit for booking link ${booking_link_uuid}: ${(error as Error).message}`);
        }
    }

    private async resolve(ref: PublicPageRef): Promise<PublicTarget> {
        const unavailable = () =>
            new NotFoundException({ message: 'This booking link is not available', code: BookingErrorCodes.LINK_INACTIVE });

        if ('code' in ref) {
            const link = await this.prisma.bookingLink.findUnique({ where: { code: ref.code }, include: LINK_INCLUDE });
            if (!link || !link.is_active || !link.booking_page.is_active) throw unavailable();
            return { page: link.booking_page, organisation: link.organisation, organisation_uuid: link.organisation_uuid, link, contact: link.contact };
        }

        const page = await this.prisma.bookingPage.findFirst({
            where: { slug: ref.page_slug, is_active: true, organisation: { slug: ref.organisation_slug } },
            include: { organisation: { select: { name: true, timezone: true } } },
        });
        if (!page) throw unavailable();
        const { organisation, ...rest } = page;
        return { page: rest, organisation, organisation_uuid: page.organisation_uuid, link: null, contact: null };
    }

    private async findByToken(token: string): Promise<ManagedBooking> {
        const booking = await this.prisma.booking.findUnique({ where: { manage_token: token }, include: MANAGE_INCLUDE });
        if (!booking) throw new NotFoundException('Booking not found');
        return booking;
    }

    private appUrl(): string {
        return this.configService.get<string>('APP_URL') ?? 'http://localhost:5173';
    }
}

function displayName(user: { full_name: string | null; email?: string }): string {
    // Never reveal team email addresses publicly; fall back to a neutral label.
    return user.full_name?.trim() || 'Our team';
}

function maskEmail(email: string | null): string | null {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!domain) return null;
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}
