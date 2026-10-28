import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import { ActivityAction, ActivityEntityType } from '@/modules/activity-logs/constants/activity-log.constants';
import { BookingsService } from './bookings.service';
import { BookingActor } from './interfaces/booking.interface';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFiltersDto, ListBookingsDto } from './dto/list-bookings.dto';
import {
    AssignBookingDto,
    CancelBookingDto,
    RescheduleBookingDto,
    UpdateBookingDto,
    UpdateBookingStatusDto,
} from './dto/booking-actions.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('bookings')
export class BookingsController {
    constructor(private readonly bookingsService: BookingsService) {}

    @Get()
    @ApiOperation({ summary: 'List bookings (paginated) with filters and search' })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListBookingsDto) {
        return this.bookingsService.findAll(organisation_uuid, query);
    }

    @Get('calendar')
    @ApiOperation({ summary: 'Bookings and blocked periods overlapping a date range (calendar views)' })
    @ApiResponse({ status: 200 })
    calendar(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: BookingFiltersDto) {
        return this.bookingsService.calendar(organisation_uuid, query);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Booking counts by status, source, page and team member' })
    @ApiResponse({ status: 200 })
    stats(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: BookingFiltersDto) {
        return this.bookingsService.stats(organisation_uuid, query);
    }

    @Get('export')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="bookings.csv"')
    @ApiProduces('text/csv')
    @ApiOperation({
        summary: 'Export bookings matching the filters as CSV',
        description: 'Returns the CSV text, not JSON. Accepts the same filters as the bookings list.',
    })
    @ApiResponse({ status: 200 })
    export(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: BookingFiltersDto) {
        return this.bookingsService.exportCsv(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Booking details with history and notifications' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Booking not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.bookingsService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING, action: ActivityAction.CREATED, entityUuidFrom: 'result.uuid' })
    @Post()
    @ApiOperation({
        summary: 'Create a manual booking for a contact or visitor',
        description:
            'Pass contact_uuid, or invitee_name and invitee_email. The slot must be free (409 otherwise); ' +
            'preview slots with the booking-pages slots tool. Set notify=false to skip the confirmation email and reminders.',
    })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 409, description: 'The slot is no longer available' })
    create(@CurrentUser() actor: BookingActor, @Body() dto: CreateBookingDto) {
        return this.bookingsService.createManual(actor, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch(':uuid')
    @ApiOperation({ summary: 'Edit invitee details, location or internal notes' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Not your booking' })
    update(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: UpdateBookingDto) {
        return this.bookingsService.update(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING, action: ActivityAction.RESCHEDULED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/reschedule')
    @ApiOperation({ summary: 'Move a booking to a new time (optionally another member)' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 409, description: 'The new slot is not available' })
    reschedule(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: RescheduleBookingDto) {
        return this.bookingsService.reschedule(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING, action: ActivityAction.CANCELLED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/cancel')
    @ApiOperation({
        summary: 'Cancel a booking and release its slot',
        description: 'Emails the invitee unless notify=false. Optionally records a reason.',
    })
    @ApiResponse({ status: 201 })
    cancel(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: CancelBookingDto) {
        return this.bookingsService.cancel(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING, action: ActivityAction.STATUS_UPDATED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/status')
    @ApiOperation({ summary: 'Confirm a pending booking, or mark it completed / no-show' })
    @ApiResponse({ status: 201 })
    setStatus(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: UpdateBookingStatusDto) {
        return this.bookingsService.setStatus(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING, action: ActivityAction.ASSIGNED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/assign')
    @ApiOperation({ summary: 'Reassign a booking to another team member (admins)' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 403, description: 'Organisation admin role required' })
    assign(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: AssignBookingDto) {
        return this.bookingsService.assign(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Permanently delete a booking (admins)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Organisation admin role required' })
    remove(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string) {
        return this.bookingsService.remove(actor, uuid);
    }

    @Post(':uuid/sync-calendar')
    @ApiOperation({
        summary: 'Retry Google Calendar synchronisation for a booking',
        description: 'Queues a sync job and returns immediately ({ queued: true }); it does not wait for Google Calendar.',
    })
    @ApiResponse({ status: 201 })
    syncCalendar(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.bookingsService.resyncCalendar(organisation_uuid, uuid);
    }

    @Post(':uuid/resend-confirmation')
    @ApiOperation({
        summary: 'Resend the confirmation email to the invitee',
        description:
            'Sends an email to the invitee immediately. Only confirmed upcoming bookings qualify (400 otherwise, or if the email fails).',
    })
    @ApiResponse({ status: 201 })
    resendConfirmation(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.bookingsService.resendConfirmation(organisation_uuid, uuid);
    }
}
