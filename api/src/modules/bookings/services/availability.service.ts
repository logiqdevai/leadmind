import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BookingActor, isOrganisationAdmin } from '../interfaces/booking.interface';
import {
    CreateBookingBlockDto,
    CreateRecurringBlockDto,
    ListBookingBlocksDto,
    ListRecurringBlocksDto,
    UpdateBookingBlockDto,
    UpdateRecurringBlockDto,
    UpsertAvailabilityOverrideDto,
    UpsertAvailabilityScheduleDto,
} from '../dto/availability.dto';
import { normalizeTimeRanges, normalizeWeeklyHours } from '../utils/availability.utils';
import { DEFAULT_WEEKLY_HOURS, isValidTimeZone, parseTimeToMinutes, WeeklyHours } from '../utils/slot-calculation.util';

/** Working hours, date overrides and blocked periods of team members. */
@Injectable()
export class AvailabilityService {
    constructor(private readonly prisma: PrismaService) {}

    /** The member's schedule; a Mon-Fri 9-17 default in the organisation timezone until they save one. */
    async getSchedule(actor: BookingActor, user_uuid = actor.uuid) {
        await this.assertCanManage(actor, user_uuid);
        const schedule = await this.prisma.availabilitySchedule.findUnique({
            where: { organisation_uuid_user_uuid: { organisation_uuid: actor.organisation_uuid, user_uuid } },
            include: { overrides: { orderBy: { date: 'asc' } } },
        });
        if (schedule) return { ...schedule, is_default: false };

        const organisation = await this.prisma.organisation.findUniqueOrThrow({
            where: { uuid: actor.organisation_uuid },
            select: { timezone: true },
        });
        return {
            uuid: null,
            organisation_uuid: actor.organisation_uuid,
            user_uuid,
            timezone: organisation.timezone,
            weekly_hours: DEFAULT_WEEKLY_HOURS,
            overrides: [],
            is_default: true,
        };
    }

    async upsertSchedule(actor: BookingActor, user_uuid: string, dto: UpsertAvailabilityScheduleDto) {
        await this.assertCanManage(actor, user_uuid);
        if (!isValidTimeZone(dto.timezone)) throw new BadRequestException(`Unknown timezone "${dto.timezone}"`);
        const { weekly_hours, error } = normalizeWeeklyHours(dto.weekly_hours);
        if (error) throw new BadRequestException(`Invalid working hours - ${error}`);

        await this.prisma.availabilitySchedule.upsert({
            where: { organisation_uuid_user_uuid: { organisation_uuid: actor.organisation_uuid, user_uuid } },
            create: {
                organisation_uuid: actor.organisation_uuid,
                user_uuid,
                timezone: dto.timezone,
                weekly_hours: weekly_hours as unknown as Prisma.InputJsonValue,
            },
            update: { timezone: dto.timezone, weekly_hours: weekly_hours as unknown as Prisma.InputJsonValue },
        });
        return this.getSchedule(actor, user_uuid);
    }

    async upsertOverride(actor: BookingActor, user_uuid: string, dto: UpsertAvailabilityOverrideDto) {
        await this.assertCanManage(actor, user_uuid);
        const { ranges, error } = normalizeTimeRanges(dto.intervals);
        if (error) throw new BadRequestException(`Invalid override - ${error}`);
        const schedule = await this.ensureSchedule(actor.organisation_uuid, user_uuid);

        return this.prisma.availabilityOverride.upsert({
            where: { schedule_uuid_date: { schedule_uuid: schedule.uuid, date: dto.date } },
            create: {
                schedule_uuid: schedule.uuid,
                date: dto.date,
                intervals: ranges as unknown as Prisma.InputJsonValue,
                reason: dto.reason ?? null,
            },
            update: { intervals: ranges as unknown as Prisma.InputJsonValue, reason: dto.reason ?? null },
        });
    }

    async removeOverride(actor: BookingActor, override_uuid: string) {
        const override = await this.prisma.availabilityOverride.findFirst({
            where: { uuid: override_uuid, schedule: { organisation_uuid: actor.organisation_uuid } },
            include: { schedule: { select: { user_uuid: true } } },
        });
        if (!override) throw new NotFoundException('Override not found');
        await this.assertCanManage(actor, override.schedule.user_uuid);
        await this.prisma.availabilityOverride.delete({ where: { uuid: override_uuid } });
        return { success: true };
    }

    async listBlocks(actor: BookingActor, query: ListBookingBlocksDto) {
        const from = new Date(query.from);
        const to = new Date(query.to);
        return this.prisma.bookingBlock.findMany({
            where: {
                organisation_uuid: actor.organisation_uuid,
                start_at: { lt: to },
                end_at: { gt: from },
                ...(query.user_uuid && { OR: [{ user_uuid: query.user_uuid }, { user_uuid: null }] }),
            },
            include: { user: { select: { uuid: true, full_name: true, email: true } } },
            orderBy: { start_at: 'asc' },
            take: 1000,
        });
    }

    async createBlock(actor: BookingActor, dto: CreateBookingBlockDto) {
        const start_at = new Date(dto.start_at);
        const end_at = new Date(dto.end_at);
        if (end_at <= start_at) throw new BadRequestException('Block must end after it starts');

        let user_uuid: string | null = dto.user_uuid ?? actor.uuid;
        if (dto.organisation_wide) {
            if (!isOrganisationAdmin(actor)) throw new ForbiddenException('Only admins can block time for everyone');
            user_uuid = null;
        } else {
            await this.assertCanManage(actor, user_uuid);
        }

        return this.prisma.bookingBlock.create({
            data: {
                organisation_uuid: actor.organisation_uuid,
                user_uuid,
                start_at,
                end_at,
                reason: dto.reason ?? null,
                created_by_user_uuid: actor.uuid,
            },
        });
    }

    async updateBlock(actor: BookingActor, block_uuid: string, dto: UpdateBookingBlockDto) {
        const block = await this.findBlock(actor, block_uuid);
        const start_at = dto.start_at ? new Date(dto.start_at) : block.start_at;
        const end_at = dto.end_at ? new Date(dto.end_at) : block.end_at;
        if (end_at <= start_at) throw new BadRequestException('Block must end after it starts');
        return this.prisma.bookingBlock.update({
            where: { uuid: block_uuid },
            data: { start_at, end_at, ...(dto.reason !== undefined && { reason: dto.reason || null }) },
        });
    }

    async removeBlock(actor: BookingActor, block_uuid: string) {
        await this.findBlock(actor, block_uuid);
        await this.prisma.bookingBlock.delete({ where: { uuid: block_uuid } });
        return { success: true };
    }

    // --- Recurring (weekly) blocked time ---

    async listRecurringBlocks(actor: BookingActor, query: ListRecurringBlocksDto) {
        return this.prisma.bookingRecurringBlock.findMany({
            where: {
                organisation_uuid: actor.organisation_uuid,
                ...(query.user_uuid && { OR: [{ user_uuid: query.user_uuid }, { user_uuid: null }] }),
            },
            include: { user: { select: { uuid: true, full_name: true, email: true } } },
            orderBy: { created_at: 'asc' },
        });
    }

    async createRecurringBlock(actor: BookingActor, dto: CreateRecurringBlockDto) {
        if (!isValidTimeZone(dto.timezone)) throw new BadRequestException(`Unknown timezone "${dto.timezone}"`);
        this.assertValidWindow(dto.start_time, dto.end_time);

        let user_uuid: string | null = dto.user_uuid ?? actor.uuid;
        if (dto.organisation_wide) {
            if (!isOrganisationAdmin(actor)) throw new ForbiddenException('Only admins can block time for everyone');
            user_uuid = null;
        } else {
            await this.assertCanManage(actor, user_uuid);
        }
        return this.prisma.bookingRecurringBlock.create({
            data: {
                organisation_uuid: actor.organisation_uuid,
                user_uuid,
                weekdays: [...new Set(dto.weekdays)].sort(),
                start_time: dto.start_time,
                end_time: dto.end_time,
                timezone: dto.timezone,
                reason: dto.reason ?? null,
                created_by_user_uuid: actor.uuid,
            },
        });
    }

    async updateRecurringBlock(actor: BookingActor, uuid: string, dto: UpdateRecurringBlockDto) {
        const block = await this.findRecurringBlock(actor, uuid);
        this.assertValidWindow(dto.start_time ?? block.start_time, dto.end_time ?? block.end_time);
        return this.prisma.bookingRecurringBlock.update({
            where: { uuid },
            data: {
                ...(dto.weekdays && { weekdays: [...new Set(dto.weekdays)].sort() }),
                ...(dto.start_time && { start_time: dto.start_time }),
                ...(dto.end_time && { end_time: dto.end_time }),
                ...(dto.reason !== undefined && { reason: dto.reason || null }),
            },
        });
    }

    async removeRecurringBlock(actor: BookingActor, uuid: string) {
        await this.findRecurringBlock(actor, uuid);
        await this.prisma.bookingRecurringBlock.delete({ where: { uuid } });
        return { success: true };
    }

    private assertValidWindow(start: string, end: string) {
        if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) throw new BadRequestException('The block must end after it starts');
    }

    private async findBlock(actor: BookingActor, block_uuid: string) {
        const block = await this.prisma.bookingBlock.findFirst({
            where: { uuid: block_uuid, organisation_uuid: actor.organisation_uuid },
        });
        if (!block) throw new NotFoundException('Blocked period not found');
        if (block.user_uuid) await this.assertCanManage(actor, block.user_uuid);
        else if (!isOrganisationAdmin(actor)) throw new ForbiddenException('Only admins can change organisation-wide blocks');
        return block;
    }

    private async findRecurringBlock(actor: BookingActor, uuid: string) {
        const block = await this.prisma.bookingRecurringBlock.findFirst({
            where: { uuid, organisation_uuid: actor.organisation_uuid },
        });
        if (!block) throw new NotFoundException('Recurring block not found');
        if (block.user_uuid) await this.assertCanManage(actor, block.user_uuid);
        else if (!isOrganisationAdmin(actor)) throw new ForbiddenException('Only admins can change organisation-wide blocks');
        return block;
    }

    /** Members manage their own availability; admins manage anyone's in the organisation. */
    async assertCanManage(actor: BookingActor, user_uuid: string) {
        if (user_uuid !== actor.uuid && !isOrganisationAdmin(actor)) {
            throw new ForbiddenException("Only admins can manage other members' availability");
        }
        const member = await this.prisma.organisationMember.findUnique({
            where: { organisation_uuid_user_uuid: { organisation_uuid: actor.organisation_uuid, user_uuid } },
            select: { uuid: true },
        });
        if (!member) throw new NotFoundException('Team member not found in this organisation');
    }

    private async ensureSchedule(organisation_uuid: string, user_uuid: string) {
        const existing = await this.prisma.availabilitySchedule.findUnique({
            where: { organisation_uuid_user_uuid: { organisation_uuid, user_uuid } },
        });
        if (existing) return existing;
        const organisation = await this.prisma.organisation.findUniqueOrThrow({
            where: { uuid: organisation_uuid },
            select: { timezone: true },
        });
        return this.prisma.availabilitySchedule.upsert({
            where: { organisation_uuid_user_uuid: { organisation_uuid, user_uuid } },
            create: {
                organisation_uuid,
                user_uuid,
                timezone: organisation.timezone,
                weekly_hours: DEFAULT_WEEKLY_HOURS as unknown as Prisma.InputJsonValue,
            },
            update: {},
        });
    }
}
