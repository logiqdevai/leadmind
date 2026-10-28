import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import { ActivityAction, ActivityEntityType } from '@/modules/activity-logs/constants/activity-log.constants';
import { BookingInvitationsService } from '../services/booking-invitations.service';
import { BookingActor } from '../interfaces/booking.interface';
import {
    ListBookingInvitationsDto,
    SendBookingInvitationDto,
    UpdateBookingInviteSettingsDto,
} from '../dto/booking-invitation.dto';

@ApiTags('booking-invitations')
@ApiBearerAuth()
@UseGuards(JwtGuard, OrganisationRolesGuard)
@Controller()
export class BookingInvitationsController {
    constructor(private readonly invitations: BookingInvitationsService) {}

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_INVITATION, action: ActivityAction.SENT, entityUuidFrom: 'result.uuid' })
    @Post('booking-invitations')
    @ApiOperation({ summary: "Email a contact their personal booking link, with follow-up reminders per the organisation's defaults" })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 400, description: 'Contact cannot be emailed, page inactive or email failed' })
    @ApiResponse({ status: 404, description: 'Contact, page or link not found' })
    send(@CurrentUser() actor: BookingActor, @Body() dto: SendBookingInvitationDto) {
        return this.invitations.send(actor, dto);
    }

    @Get('booking-invitations')
    @ApiOperation({ summary: 'Booking links emailed to a contact and the state of their reminders' })
    @ApiResponse({ status: 200 })
    findForContact(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListBookingInvitationsDto) {
        return this.invitations.findForContact(organisation_uuid, query.contact_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_INVITATION, action: ActivityAction.CANCELLED, entityUuidFrom: 'params.uuid' })
    @Post('booking-invitations/:uuid/stop')
    @ApiOperation({ summary: 'Stop the pending reminders of an invitation' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Invitation not found' })
    stop(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.invitations.stop(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_INVITATION, action: ActivityAction.SENT, entityUuidFrom: 'result.uuid' })
    @Post('booking-invitations/:uuid/resend')
    @ApiOperation({ summary: 'Email the same booking link to the contact again, restarting its reminders' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 400, description: 'Contact cannot be emailed, link or page inactive, or email failed' })
    @ApiResponse({ status: 404, description: 'Invitation not found' })
    resend(@CurrentUser() actor: BookingActor, @Param('uuid') uuid: string) {
        return this.invitations.resend(actor, uuid);
    }

    @Get('booking-invite-settings')
    @ApiOperation({ summary: 'Organisation-wide defaults for emailed booking links and their reminders' })
    @ApiResponse({ status: 200 })
    getSettings(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.invitations.getSettings(organisation_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.BOOKING_INVITE_SETTINGS, action: ActivityAction.UPDATED })
    @Patch('booking-invite-settings')
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Update the organisation-wide invitation and reminder defaults' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 403, description: 'Organisation admin role required' })
    updateSettings(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: UpdateBookingInviteSettingsDto) {
        return this.invitations.updateSettings(organisation_uuid, dto);
    }
}
