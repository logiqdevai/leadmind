import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import { ActivityAction, ActivityEntityType } from '@/modules/activity-logs/constants/activity-log.constants';
import { AvailabilityService } from '../services/availability.service';
import { BookingActor } from '../interfaces/booking.interface';
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

/** `user_uuid` defaults to the current member; other members require the admin role. */
@ApiTags('availability')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('availability')
export class AvailabilityController {
    constructor(private readonly availabilityService: AvailabilityService) {}

    @Get('schedule')
    @ApiQuery({ name: 'user_uuid', required: false })
    @ApiOperation({ summary: "A member's weekly working hours and date overrides" })
    @ApiResponse({ status: 200 })
    getSchedule(@CurrentUser() actor: BookingActor, @Query('user_uuid') user_uuid?: string) {
        return this.availabilityService.getSchedule(actor, user_uuid || actor.uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.AVAILABILITY_SCHEDULE, action: ActivityAction.UPDATED })
    @Put('schedule')
    @ApiQuery({ name: 'user_uuid', required: false })
    @ApiOperation({ summary: 'Save weekly working hours and timezone' })
    @ApiResponse({ status: 200 })
    upsertSchedule(
        @CurrentUser() actor: BookingActor,
        @Body() dto: UpsertAvailabilityScheduleDto,
        @Query('user_uuid') user_uuid?: string,
    ) {
        return this.availabilityService.upsertSchedule(actor, user_uuid || actor.uuid, dto);
    }

    @Put('overrides')
    @ApiQuery({ name: 'user_uuid', required: false })
    @ApiOperation({ summary: 'Set custom hours (or a day off) for one date' })
    @ApiResponse({ status: 200 })
    upsertOverride(
        @CurrentUser() actor: BookingActor,
        @Body() dto: UpsertAvailabilityOverrideDto,
        @Query('user_uuid') user_uuid?: string,
    ) {
        return this.availabilityService.upsertOverride(actor, user_uuid || actor.uuid, dto);
    }

    @Delete('overrides/:uuid')
    @ApiOperation({ summary: 'Remove a date override (the weekly hours apply again)' })
    @ApiResponse({ status: 200 })
    removeOverride(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string) {
        return this.availabilityService.removeOverride(actor, uuid);
    }

    @Get('blocks')
    @ApiOperation({ summary: 'Blocked periods (holidays, time off, blocked slots) in a range' })
    @ApiResponse({ status: 200 })
    listBlocks(@CurrentUser() actor: BookingActor, @Query() query: ListBookingBlocksDto) {
        return this.availabilityService.listBlocks(actor, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_BLOCK, action: ActivityAction.CREATED, entityUuidFrom: 'result.uuid' })
    @Post('blocks')
    @ApiOperation({ summary: 'Block a period for a member or the whole organisation' })
    @ApiResponse({ status: 201 })
    createBlock(@CurrentUser() actor: BookingActor, @Body() dto: CreateBookingBlockDto) {
        return this.availabilityService.createBlock(actor, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_BLOCK, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch('blocks/:uuid')
    @ApiOperation({ summary: 'Edit a blocked period' })
    @ApiResponse({ status: 200 })
    updateBlock(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: UpdateBookingBlockDto) {
        return this.availabilityService.updateBlock(actor, uuid, dto);
    }

    @Get('recurring-blocks')
    @ApiOperation({ summary: 'Weekly repeating blocked time windows' })
    @ApiResponse({ status: 200 })
    listRecurringBlocks(@CurrentUser() actor: BookingActor, @Query() query: ListRecurringBlocksDto) {
        return this.availabilityService.listRecurringBlocks(actor, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_BLOCK, action: ActivityAction.CREATED, entityUuidFrom: 'result.uuid' })
    @Post('recurring-blocks')
    @ApiOperation({ summary: 'Permanently block a time window on chosen weekdays' })
    @ApiResponse({ status: 201 })
    createRecurringBlock(@CurrentUser() actor: BookingActor, @Body() dto: CreateRecurringBlockDto) {
        return this.availabilityService.createRecurringBlock(actor, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_BLOCK, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch('recurring-blocks/:uuid')
    @ApiOperation({ summary: 'Edit a recurring blocked time window' })
    @ApiResponse({ status: 200 })
    updateRecurringBlock(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: UpdateRecurringBlockDto) {
        return this.availabilityService.updateRecurringBlock(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_BLOCK, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete('recurring-blocks/:uuid')
    @ApiOperation({ summary: 'Remove a recurring blocked time window' })
    @ApiResponse({ status: 200 })
    removeRecurringBlock(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string) {
        return this.availabilityService.removeRecurringBlock(actor, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_BLOCK, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete('blocks/:uuid')
    @ApiOperation({ summary: 'Remove a blocked period' })
    @ApiResponse({ status: 200 })
    removeBlock(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string) {
        return this.availabilityService.removeBlock(actor, uuid);
    }
}
