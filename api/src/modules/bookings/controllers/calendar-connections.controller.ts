import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import { ActivityAction, ActivityEntityType } from '@/modules/activity-logs/constants/activity-log.constants';
import { CalendarConnectionsService } from '../services/calendar-connections.service';
import { BookingActor } from '../interfaces/booking.interface';
import { UpdateCalendarConnectionDto, VerifyCalendarConnectionDto } from '../dto/calendar-connection.dto';

@ApiTags('calendar-connections')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('calendar-connections')
export class CalendarConnectionsController {
    constructor(private readonly calendarConnectionsService: CalendarConnectionsService) {}

    @Get()
    @ApiOperation({ summary: 'Google Calendar connections (own; admins see every member)' })
    @ApiResponse({ status: 200 })
    list(@CurrentUser() actor: BookingActor) {
        return this.calendarConnectionsService.list(actor);
    }

    @Post('connect')
    @ApiOperation({ summary: 'Start connecting the current member\'s Google account (returns the OAuth redirect URL)' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 503, description: 'Composio is not configured' })
    connect(@CurrentUser() actor: BookingActor) {
        return this.calendarConnectionsService.connect(actor);
    }

    @ActivityLog({ entityType: ActivityEntityType.CALENDAR_CONNECTION, action: ActivityAction.CONNECTED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/verify')
    @ApiBody({ type: VerifyCalendarConnectionDto })
    @ApiOperation({ summary: 'Finish connecting after the OAuth redirect' })
    @ApiResponse({ status: 201 })
    verify(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: VerifyCalendarConnectionDto) {
        return this.calendarConnectionsService.verify(actor, uuid, dto.connected_account_id);
    }

    @Get(':uuid/calendars')
    @ApiOperation({ summary: 'Writable calendars of the connected Google account' })
    @ApiResponse({ status: 200 })
    listCalendars(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string) {
        return this.calendarConnectionsService.listCalendars(actor, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.CALENDAR_CONNECTION, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch(':uuid')
    @ApiOperation({ summary: 'Choose the calendar for booking events / toggle conflict checking' })
    @ApiResponse({ status: 200 })
    update(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string, @Body() dto: UpdateCalendarConnectionDto) {
        return this.calendarConnectionsService.update(actor, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.CALENDAR_CONNECTION, action: ActivityAction.DISCONNECTED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Disconnect Google Calendar (bookings are kept)' })
    @ApiResponse({ status: 200 })
    disconnect(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string) {
        return this.calendarConnectionsService.disconnect(actor, uuid);
    }
}
