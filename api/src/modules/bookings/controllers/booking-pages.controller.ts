import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import { ActivityAction, ActivityEntityType } from '@/modules/activity-logs/constants/activity-log.constants';
import { BookingPagesService } from '../services/booking-pages.service';
import { BookingActor } from '../interfaces/booking.interface';
import { CreateBookingPageDto } from '../dto/create-booking-page.dto';
import { UpdateBookingPageDto } from '../dto/update-booking-page.dto';
import { BookingSlotsQueryDto } from '../dto/booking-slots-query.dto';

@ApiTags('booking-pages')
@ApiBearerAuth()
@UseGuards(JwtGuard, OrganisationRolesGuard)
@Controller('booking-pages')
export class BookingPagesController {
    constructor(private readonly bookingPagesService: BookingPagesService) {}

    @Get()
    @ApiOperation({ summary: 'List booking pages (appointment types) of the organisation' })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.bookingPagesService.findAll(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Booking page configuration' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Booking page not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.bookingPagesService.findOne(organisation_uuid, uuid);
    }

    @Get(':uuid/slots')
    @ApiOperation({ summary: 'Preview available slots (with the members free at each)' })
    @ApiResponse({ status: 200 })
    previewSlots(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: BookingSlotsQueryDto,
    ) {
        return this.bookingPagesService.previewSlots(organisation_uuid, uuid, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_PAGE, action: ActivityAction.CREATED, entityUuidFrom: 'result.uuid', includeBodyKeys: ['name'] })
    @Post()
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Create a booking page' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 403, description: 'Organisation admin role required' })
    create(@CurrentUser() actor: BookingActor, @Body() dto: CreateBookingPageDto) {
        return this.bookingPagesService.create(actor, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_PAGE, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch(':uuid')
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Update a booking page (rules, team, notifications, branding, publish state)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Organisation admin role required' })
    update(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: UpdateBookingPageDto) {
        return this.bookingPagesService.update(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_PAGE, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Delete a booking page (its bookings are kept)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Organisation admin role required' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.bookingPagesService.remove(organisation_uuid, uuid);
    }
}
