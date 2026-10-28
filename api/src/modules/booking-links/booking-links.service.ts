import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BookingPublicUrls, generateBookingLinkCode } from './utils/booking-url.util';
import { CreateBookingLinkDto } from './dto/create-booking-link.dto';
import { UpdateBookingLinkDto } from './dto/update-booking-link.dto';
import { ListBookingLinksDto } from './dto/list-booking-links.dto';

const BOOKING_LINK_PLACEHOLDER = /\{\{\s*booking_link\s*\}\}/;
const DEFAULT_CTA_LABEL = 'Book a meeting';
const CODE_ATTEMPTS = 5;

export interface BookingLinkContext {
    sequence_step_uuid?: string | null;
    /** Explicit page (e.g. picked in the composer); wins over step/template settings. */
    booking_page_uuid?: string | null;
    /** The CTA block is HTML - only for email bodies. */
    allow_cta?: boolean;
}

export interface ResolvedBookingContent {
    content: string;
    booking_link: string | null;
}

@Injectable()
export class BookingLinksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {}

    publicUrl(code: string): string {
        return BookingPublicUrls.page(this.appUrl(), code);
    }

    publicSlugUrl(organisation_slug: string, page_slug: string): string {
        return BookingPublicUrls.slug(this.appUrl(), organisation_slug, page_slug);
    }

    async create(organisation_uuid: string, user_uuid: string | null, dto: CreateBookingLinkDto) {
        await this.assertPage(organisation_uuid, dto.booking_page_uuid);
        if (dto.contact_uuid) await this.assertContact(organisation_uuid, dto.contact_uuid);

        const link = await this.insertWithUniqueCode({
            organisation_uuid,
            booking_page_uuid: dto.booking_page_uuid,
            contact_uuid: dto.contact_uuid ?? null,
            label: dto.label ?? null,
            // Contact links already know who the invitee is.
            auto_create_contact: dto.contact_uuid ? false : !!dto.auto_create_contact,
            created_by_user_uuid: user_uuid,
        });
        return this.withUrl(link);
    }

    async findAll(organisation_uuid: string, query: ListBookingLinksDto) {
        const links = await this.prisma.bookingLink.findMany({
            where: {
                organisation_uuid,
                ...(query.booking_page_uuid && { booking_page_uuid: query.booking_page_uuid }),
                ...(query.contact_uuid && { contact_uuid: query.contact_uuid }),
                ...(query.generic_only && { contact_uuid: null }),
                ...(!query.include_inactive && { is_active: true }),
            },
            include: {
                booking_page: { select: { uuid: true, name: true, slug: true, is_active: true } },
                contact: { select: { uuid: true, name: true, email: true } },
                _count: { select: { bookings: true, visits: true } },
            },
            orderBy: { created_at: 'desc' },
            take: 500,
        });
        return links.map((link) => this.withUrl(link));
    }

    async update(organisation_uuid: string, uuid: string, dto: UpdateBookingLinkDto) {
        const link = await this.findOwned(organisation_uuid, uuid);
        const updated = await this.prisma.bookingLink.update({
            where: { uuid },
            data: {
                ...(dto.label !== undefined && { label: dto.label }),
                ...(dto.auto_create_contact !== undefined && !link.contact_uuid && { auto_create_contact: dto.auto_create_contact }),
                ...(dto.is_active !== undefined && {
                    is_active: dto.is_active,
                    deactivated_at: dto.is_active ? null : new Date(),
                }),
            },
        });
        return this.withUrl(updated);
    }

    /** Deactivates the link and issues a new code with the same settings (e.g. the old URL leaked). */
    async regenerate(organisation_uuid: string, user_uuid: string | null, uuid: string) {
        const link = await this.findOwned(organisation_uuid, uuid);
        await this.prisma.bookingLink.update({
            where: { uuid },
            data: { is_active: false, deactivated_at: new Date() },
        });
        const fresh = await this.insertWithUniqueCode({
            organisation_uuid,
            booking_page_uuid: link.booking_page_uuid,
            contact_uuid: link.contact_uuid,
            label: link.label,
            auto_create_contact: link.auto_create_contact,
            created_by_user_uuid: user_uuid,
        });
        return this.withUrl(fresh);
    }

    async remove(organisation_uuid: string, uuid: string) {
        await this.findOwned(organisation_uuid, uuid);
        // Bookings keep their history; their link reference is cleared (onDelete: SetNull).
        await this.prisma.bookingLink.delete({ where: { uuid } });
        return { success: true };
    }

    /** The contact's active link for a page, created on first use - one link per contact per page, not per email. */
    async getOrCreateContactLink(organisation_uuid: string, booking_page_uuid: string, contact_uuid: string) {
        const existing = await this.prisma.bookingLink.findFirst({
            where: { organisation_uuid, booking_page_uuid, contact_uuid, is_active: true },
            orderBy: { created_at: 'asc' },
        });
        if (existing) return existing;
        return this.insertWithUniqueCode({
            organisation_uuid,
            booking_page_uuid,
            contact_uuid,
            label: null,
            auto_create_contact: false,
            created_by_user_uuid: null,
        });
    }

    /**
     * Resolves `{{booking_link}}` (and the optional appended CTA) for one outgoing email to one contact.
     * Only touches the database when the content asks for a link, so ordinary sends stay cheap.
     */
    async resolveForOutgoingEmail(
        organisation_uuid: string,
        contact_uuid: string,
        content: string,
        context: BookingLinkContext,
    ): Promise<ResolvedBookingContent> {
        const step = context.sequence_step_uuid
            ? await this.prisma.outreachSequenceStep.findUnique({
                  where: { uuid: context.sequence_step_uuid },
                  select: {
                      booking_page_uuid: true,
                      append_booking_cta: true,
                      message_template: { select: { booking_page_uuid: true, append_booking_cta: true } },
                  },
              })
            : null;

        const appendCta =
            context.allow_cta !== false && !!(step?.append_booking_cta || step?.message_template?.append_booking_cta);
        const hasPlaceholder = BOOKING_LINK_PLACEHOLDER.test(content);
        if (!hasPlaceholder && !appendCta) return { content, booking_link: null };

        const pageUuid =
            context.booking_page_uuid ?? step?.booking_page_uuid ?? step?.message_template?.booking_page_uuid ?? null;
        const page = await this.prisma.bookingPage.findFirst({
            where: pageUuid
                ? { uuid: pageUuid, organisation_uuid, is_active: true }
                : { organisation_uuid, is_active: true, is_default: true },
            select: { uuid: true, cta_label: true, primary_color: true },
        });
        if (!page) return { content, booking_link: null };

        const link = await this.getOrCreateContactLink(organisation_uuid, page.uuid, contact_uuid);
        const url = this.publicUrl(link.code);
        const withCta =
            appendCta && !hasPlaceholder ? `${content}${bookingCtaHtml(url, page.cta_label, page.primary_color)}` : content;
        return { content: withCta, booking_link: url };
    }

    private async insertWithUniqueCode(data: Omit<Prisma.BookingLinkUncheckedCreateInput, 'code'>) {
        for (let attempt = 1; ; attempt++) {
            try {
                return await this.prisma.bookingLink.create({ data: { ...data, code: generateBookingLinkCode() } });
            } catch (error) {
                const isCodeClash =
                    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < CODE_ATTEMPTS;
                if (!isCodeClash) throw error;
            }
        }
    }

    private async findOwned(organisation_uuid: string, uuid: string) {
        const link = await this.prisma.bookingLink.findFirst({ where: { uuid, organisation_uuid } });
        if (!link) throw new NotFoundException('Booking link not found');
        return link;
    }

    private async assertPage(organisation_uuid: string, booking_page_uuid: string) {
        const page = await this.prisma.bookingPage.findFirst({
            where: { uuid: booking_page_uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!page) throw new NotFoundException('Booking page not found');
    }

    private async assertContact(organisation_uuid: string, contact_uuid: string) {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid: contact_uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!contact) throw new NotFoundException('Contact not found');
    }

    private withUrl<T extends { code: string }>(link: T): T & { url: string } {
        return { ...link, url: this.publicUrl(link.code) };
    }

    private appUrl(): string {
        return this.configService.get<string>('APP_URL') ?? 'http://localhost:5173';
    }
}

/** Table-cell button: survives sanitizeEmailHtml (which only allows padding/background on td) and most clients. */
export function bookingCtaHtml(url: string, label: string | null, color: string | null): string {
    const background = /^#[0-9a-fA-F]{3,8}$/.test(color ?? '') ? color : '#111827';
    const text = escapeHtml(label?.trim() || DEFAULT_CTA_LABEL);
    return (
        `<p>&nbsp;</p><table cellpadding="0" cellspacing="0" border="0"><tbody><tr>` +
        `<td style="background-color:${background};padding:10px 18px">` +
        `<a href="${url}" style="color:#ffffff;font-weight:600;text-decoration:none">${text}</a>` +
        `</td></tr></tbody></table>`
    );
}

/** Plain text link on its own line, for emails written in the recipient's language (the table button above is not). */
export function bookingLinkHtml(url: string, label: string): string {
    return `<p><a href="${url}" style="font-weight:600">${escapeHtml(label)}</a></p>`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
