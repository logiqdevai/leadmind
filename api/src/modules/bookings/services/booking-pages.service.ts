import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingLocationType, BookingNotificationKind, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BookingLinksService } from '@/modules/booking-links/booking-links.service';
import { BookingActor } from '../interfaces/booking.interface';
import { CreateBookingPageDto } from '../dto/create-booking-page.dto';
import { UpdateBookingPageDto } from '../dto/update-booking-page.dto';
import { BookingSlotsQueryDto } from '../dto/booking-slots-query.dto';
import { BookingSlotService } from './booking-slot.service';

const PAGE_INCLUDE = {
    members: {
        include: { user: { select: { uuid: true, full_name: true, email: true } } },
        orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
    },
    notification_templates: { select: { kind: true, template_uuid: true }, orderBy: { created_at: 'asc' } },
    _count: { select: { bookings: true, links: true } },
} satisfies Prisma.BookingPageInclude;

type TemplateUuids = Pick<
    CreateBookingPageDto,
    'confirmation_template_uuids' | 'reminder_template_uuids' | 'cancellation_template_uuids' | 'reschedule_template_uuids'
>;

/** Which dto field holds the templates of each email type. */
const TEMPLATE_FIELDS = {
    [BookingNotificationKind.CONFIRMATION]: 'confirmation_template_uuids',
    [BookingNotificationKind.REMINDER]: 'reminder_template_uuids',
    [BookingNotificationKind.CANCELLATION]: 'cancellation_template_uuids',
    [BookingNotificationKind.RESCHEDULE]: 'reschedule_template_uuids',
} as const satisfies Record<BookingNotificationKind, keyof TemplateUuids>;

/** Replaces the raw join rows with one uuid list per email type, the shape the dto accepts. */
function withTemplateUuids<T extends { notification_templates: Array<{ kind: BookingNotificationKind; template_uuid: string }> }>(
    page: T,
) {
    const { notification_templates, ...rest } = page;
    const lists = Object.fromEntries(
        Object.values(TEMPLATE_FIELDS).map((field) => [field, [] as string[]]),
    ) as Required<TemplateUuids>;
    for (const row of notification_templates) lists[TEMPLATE_FIELDS[row.kind]].push(row.template_uuid);
    return { ...rest, ...lists };
}

@Injectable()
export class BookingPagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly bookingLinksService: BookingLinksService,
        private readonly slotService: BookingSlotService,
    ) {}

    async findAll(organisation_uuid: string) {
        const pages = await this.prisma.bookingPage.findMany({
            where: { organisation_uuid },
            include: PAGE_INCLUDE,
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        const organisation = await this.prisma.organisation.findUniqueOrThrow({
            where: { uuid: organisation_uuid },
            select: { slug: true },
        });
        return pages.map((page) => ({
            ...withTemplateUuids(page),
            public_url: this.publicUrlFor(organisation.slug, page),
        }));
    }

    /** The page's own URL (organisation + page slug); only meaningful while the page is active. */
    private publicUrlFor(organisation_slug: string, page: { slug: string; is_active: boolean }): string | null {
        return page.is_active ? this.bookingLinksService.publicSlugUrl(organisation_slug, page.slug) : null;
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const page = await this.prisma.bookingPage.findFirst({
            where: { uuid, organisation_uuid },
            include: PAGE_INCLUDE,
        });
        if (!page) throw new NotFoundException('Booking page not found');
        const organisation = await this.prisma.organisation.findUniqueOrThrow({
            where: { uuid: organisation_uuid },
            select: { slug: true },
        });
        return { ...withTemplateUuids(page), public_url: this.publicUrlFor(organisation.slug, page) };
    }

    async create(actor: BookingActor, dto: CreateBookingPageDto) {
        const { members, questions, ...rest } = dto;
        const { templates, fields } = this.splitTemplates(rest);
        this.assertConsistent(dto);
        const slug = dto.slug ?? (await this.uniqueSlug(actor.organisation_uuid, dto.name));
        const memberRows = members?.length ? members : [{ user_uuid: actor.uuid, priority: 0 }];
        await this.assertMembers(actor.organisation_uuid, memberRows.map((m) => m.user_uuid));
        await this.assertTemplates(actor.organisation_uuid, templates);

        const page = await this.prisma.$transaction(async (tx) => {
            const isFirst = (await tx.bookingPage.count({ where: { organisation_uuid: actor.organisation_uuid } })) === 0;
            const makeDefault = dto.is_default ?? isFirst;
            if (makeDefault) {
                await tx.bookingPage.updateMany({
                    where: { organisation_uuid: actor.organisation_uuid, is_default: true },
                    data: { is_default: false },
                });
            }
            try {
                const created = await tx.bookingPage.create({
                    data: {
                        ...fields,
                        slug,
                        is_default: makeDefault,
                        questions: (questions ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
                        organisation_uuid: actor.organisation_uuid,
                        created_by_user_uuid: actor.uuid,
                        members: {
                            create: memberRows.map((m) => ({ user_uuid: m.user_uuid, priority: m.priority ?? 0 })),
                        },
                    },
                });
                await this.replaceTemplates(tx, created.uuid, templates);
                return created;
            } catch (error) {
                throw this.mapUniqueError(error);
            }
        });

        // Every page gets a shareable generic link straight away.
        await this.bookingLinksService.create(actor.organisation_uuid, actor.uuid, {
            booking_page_uuid: page.uuid,
            label: 'Public link',
        });
        return this.findOne(actor.organisation_uuid, page.uuid);
    }

    async update(actor: BookingActor, uuid: string, dto: UpdateBookingPageDto) {
        const existing = await this.prisma.bookingPage.findFirst({ where: { uuid, organisation_uuid: actor.organisation_uuid } });
        if (!existing) throw new NotFoundException('Booking page not found');
        this.assertConsistent({ ...existing, ...dto } as CreateBookingPageDto);
        const { members, questions, ...rest } = dto;
        const { templates, fields } = this.splitTemplates(rest);
        if (members) {
            if (members.length === 0) throw new BadRequestException('A booking page needs at least one eligible team member');
            await this.assertMembers(actor.organisation_uuid, members.map((m) => m.user_uuid));
        }
        await this.assertTemplates(actor.organisation_uuid, templates);

        await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) {
                await tx.bookingPage.updateMany({
                    where: { organisation_uuid: actor.organisation_uuid, is_default: true, uuid: { not: uuid } },
                    data: { is_default: false },
                });
            }
            try {
                await tx.bookingPage.update({
                    where: { uuid },
                    data: {
                        ...fields,
                        ...(questions !== undefined && { questions: questions as unknown as Prisma.InputJsonValue }),
                    },
                });
            } catch (error) {
                throw this.mapUniqueError(error);
            }
            await this.replaceTemplates(tx, uuid, templates);
            if (members) {
                // Keep round-robin history (last_assigned_at) for members that stay.
                await tx.bookingPageMember.deleteMany({
                    where: { booking_page_uuid: uuid, user_uuid: { notIn: members.map((m) => m.user_uuid) } },
                });
                for (const member of members) {
                    await tx.bookingPageMember.upsert({
                        where: { booking_page_uuid_user_uuid: { booking_page_uuid: uuid, user_uuid: member.user_uuid } },
                        create: { booking_page_uuid: uuid, user_uuid: member.user_uuid, priority: member.priority ?? 0 },
                        update: { priority: member.priority ?? 0 },
                    });
                }
            }
        });
        return this.findOne(actor.organisation_uuid, uuid);
    }

    async remove(organisation_uuid: string, uuid: string) {
        await this.findOne(organisation_uuid, uuid);
        // Bookings are kept (booking_page_uuid -> null); links are removed with the page.
        await this.prisma.bookingPage.delete({ where: { uuid } });
        return { success: true };
    }

    /** Preview of what invitees would be offered - lets admins check rules before publishing. */
    async previewSlots(organisation_uuid: string, uuid: string, query: BookingSlotsQueryDto) {
        const page = await this.prisma.bookingPage.findFirst({ where: { uuid, organisation_uuid } });
        if (!page) throw new NotFoundException('Booking page not found');
        const range = this.slotService.parseRange(query.from, query.to);
        const duration = query.duration ?? page.duration_minutes;
        const slots = await this.slotService.getSlots(page, range, {
            duration,
            member_uuid: query.member_uuid,
            exclude_booking_uuid: query.exclude_booking_uuid,
            include_unavailable: !!query.include_unavailable,
        });
        return this.slotService.groupByDate(slots, query.timezone ?? 'UTC', duration, true);
    }

    private assertConsistent(dto: Partial<CreateBookingPageDto>) {
        const needsValue: BookingLocationType[] = [BookingLocationType.IN_PERSON, BookingLocationType.CUSTOM];
        if (dto.location_type && needsValue.includes(dto.location_type) && !dto.location_value?.trim()) {
            throw new BadRequestException('Add an address or details for this location type');
        }
        if (dto.max_gap_minutes != null && dto.min_gap_minutes != null && dto.max_gap_minutes < dto.min_gap_minutes) {
            throw new BadRequestException('Maximum time between bookings must be at least the minimum');
        }
        const ids = (dto.questions ?? []).map((q) => q.id);
        if (new Set(ids).size !== ids.length) throw new BadRequestException('Booking question ids must be unique');
        for (const q of dto.questions ?? []) {
            if (q.type === 'SELECT' && !q.options?.length) throw new BadRequestException(`Question "${q.label}" needs options`);
        }
    }

    private async assertMembers(organisation_uuid: string, user_uuids: string[]) {
        const unique = [...new Set(user_uuids)];
        const count = await this.prisma.organisationMember.count({
            where: { organisation_uuid, user_uuid: { in: unique } },
        });
        if (count !== unique.length) throw new BadRequestException('Every eligible member must belong to this organisation');
    }

    /** Separates the per-email-type template lists (join rows) from the page's own columns. */
    private splitTemplates<T extends Partial<TemplateUuids>>(dto: T) {
        const {
            confirmation_template_uuids,
            reminder_template_uuids,
            cancellation_template_uuids,
            reschedule_template_uuids,
            ...fields
        } = dto;
        const templates: Partial<Record<BookingNotificationKind, string[]>> = {
            [BookingNotificationKind.CONFIRMATION]: confirmation_template_uuids,
            [BookingNotificationKind.REMINDER]: reminder_template_uuids,
            [BookingNotificationKind.CANCELLATION]: cancellation_template_uuids,
            [BookingNotificationKind.RESCHEDULE]: reschedule_template_uuids,
        };
        return { templates, fields };
    }

    private async assertTemplates(
        organisation_uuid: string,
        templates: Partial<Record<BookingNotificationKind, string[]>>,
    ) {
        const unique = [...new Set(Object.values(templates).flat().filter(Boolean) as string[])];
        if (!unique.length) return;
        const count = await this.prisma.messageTemplate.count({ where: { organisation_uuid, uuid: { in: unique } } });
        if (count !== unique.length) throw new BadRequestException('Email template not found');
    }

    /** Replaces the templates of each email type that was sent (an empty list clears it); omitted types are left alone. */
    private async replaceTemplates(
        tx: Prisma.TransactionClient,
        booking_page_uuid: string,
        templates: Partial<Record<BookingNotificationKind, string[]>>,
    ) {
        for (const [kind, uuids] of Object.entries(templates) as Array<[BookingNotificationKind, string[] | undefined]>) {
            if (!uuids) continue;
            const unique = [...new Set(uuids)];
            await tx.bookingPageTemplate.deleteMany({
                where: { booking_page_uuid, kind, template_uuid: { notIn: unique } },
            });
            if (unique.length) {
                await tx.bookingPageTemplate.createMany({
                    data: unique.map((template_uuid) => ({ booking_page_uuid, kind, template_uuid })),
                    skipDuplicates: true,
                });
            }
        }
    }

    private async uniqueSlug(organisation_uuid: string, name: string): Promise<string> {
        const base =
            name
                .toLowerCase()
                .normalize('NFKD')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 50) || 'meeting';
        const taken = new Set(
            (
                await this.prisma.bookingPage.findMany({
                    where: { organisation_uuid, slug: { startsWith: base } },
                    select: { slug: true },
                })
            ).map((p) => p.slug),
        );
        if (!taken.has(base)) return base;
        for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
    }

    private mapUniqueError(error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return new ConflictException('Another booking page already uses this slug');
        }
        return error;
    }
}
