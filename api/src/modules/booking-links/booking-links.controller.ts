import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import { ActivityAction, ActivityEntityType } from '@/modules/activity-logs/constants/activity-log.constants';
import { BookingLinksService } from './booking-links.service';
import { CreateBookingLinkDto } from './dto/create-booking-link.dto';
import { UpdateBookingLinkDto } from './dto/update-booking-link.dto';
import { ListBookingLinksDto } from './dto/list-booking-links.dto';

@ApiTags('booking-links')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('booking-links')
export class BookingLinksController {
    constructor(private readonly bookingLinksService: BookingLinksService) {}

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_LINK, action: ActivityAction.CREATED, entityUuidFrom: 'result.uuid' })
    @Post()
    @ApiOperation({ summary: 'Create a generic or contact-specific booking link' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Booking page or contact not found' })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Body() dto: CreateBookingLinkDto,
    ) {
        return this.bookingLinksService.create(organisation_uuid, user_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List booking links, optionally for one page or contact' })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListBookingLinksDto) {
        return this.bookingLinksService.findAll(organisation_uuid, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_LINK, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch(':uuid')
    @ApiOperation({ summary: 'Rename, (de)activate or change contact creation of a link' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Booking link not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateBookingLinkDto,
    ) {
        return this.bookingLinksService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_LINK, action: ActivityAction.REGENERATED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/regenerate')
    @ApiOperation({ summary: 'Deactivate the link and issue a new URL with the same settings' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Booking link not found' })
    regenerate(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.bookingLinksService.regenerate(organisation_uuid, user_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_LINK, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @UseGuards(OrganisationRolesGuard)
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Delete a booking link (bookings made through it are kept)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Forbidden - organisation admin role required' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.bookingLinksService.remove(organisation_uuid, uuid);
    }
}
