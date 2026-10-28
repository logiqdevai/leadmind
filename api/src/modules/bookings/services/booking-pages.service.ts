import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingLocationType, Prisma } from '@/generated/prisma';
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
    _count: { select: { bookings: true, links: true } },
} satisfies Prisma.BookingPageInclude;

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
            ...page,
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
        return { ...page, public_url: this.publicUrlFor(organisation.slug, page) };
    }

    async create(actor: BookingActor, dto: CreateBookingPageDto) {
        const { members, questions, ...fields } = dto;
        this.assertConsistent(dto);
        const slug = dto.slug ?? (await this.uniqueSlug(actor.organisation_uuid, dto.name));
        const memberRows = members?.length ? members : [{ user_uuid: actor.uuid, priority: 0 }];
        await this.assertMembers(actor.organisation_uuid, memberRows.map((m) => m.user_uuid));
        await this.assertTemplates(actor.organisation_uuid, dto);

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
                return await tx.bookingPage.create({
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
        const { members, questions, ...fields } = dto;
        if (members) {
            if (members.length === 0) throw new BadRequestException('A booking page needs at least one eligible team member');
            await this.assertMembers(actor.organisation_uuid, members.map((m) => m.user_uuid));
        }
        await this.assertTemplates(actor.organisation_uuid, dto);

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

    private async assertTemplates(organisation_uuid: string, dto: Partial<CreateBookingPageDto>) {
        const uuids = [
            dto.confirmation_template_uuid,
            dto.reminder_template_uuid,
            dto.cancellation_template_uuid,
            dto.reschedule_template_uuid,
        ].filter(Boolean) as string[];
        if (!uuids.length) return;
        const unique = [...new Set(uuids)];
        const count = await this.prisma.messageTemplate.count({ where: { organisation_uuid, uuid: { in: unique } } });
        if (count !== unique.length) throw new BadRequestException('Email template not found');
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
