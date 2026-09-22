import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('organisations')
@Controller('organisations')
export class OrganisationsController {
    constructor(private readonly organisationsService: OrganisationsService) {}

    @Get('invitations/:token')
    @ApiOperation({ summary: 'Preview an organisation invitation' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Invitation not found or expired' })
    previewInvitation(@Param('token') token: string) {
        return this.organisationsService.previewInvitation(token);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION_INVITATION, action: ActivityAction.INVITATION_ACCEPTED })
    @Post('invitations/:token/accept')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Accept an organisation invitation' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Invitation not found or expired' })
    acceptInvitation(
        @Param('token') token: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.acceptInvitation(token, userUuid);
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'List organisations for the current user' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    list(@CurrentUser('uuid') userUuid: string) {
        return this.organisationsService.listForUser(userUuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION, action: ActivityAction.CREATED, includeBodyKeys: ['name'] })
    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Create a new organisation' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    create(
        @CurrentUser('uuid') userUuid: string,
        @Body() dto: CreateOrganisationDto,
    ) {
        return this.organisationsService.create(userUuid, dto);
    }

    @Get('current')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Get the active organisation' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getCurrent(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.getCurrent(organisationUuid, userUuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid', organisationUuidFrom: 'params.uuid' })
    @Patch(':uuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Update organisation' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Organisation not found' })
    update(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Body() dto: UpdateOrganisationDto,
    ) {
        return this.organisationsService.update(uuid, userUuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid', organisationUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Delete organisation' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Organisation not found' })
    remove(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.remove(uuid, userUuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION, action: ActivityAction.SWITCHED, entityUuidFrom: 'params.uuid', organisationUuidFrom: 'params.uuid' })
    @Post(':uuid/switch')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Switch active organisation' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Organisation not found' })
    switchOrganisation(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.switchOrganisation(uuid, userUuid);
    }

    @Get(':uuid/members')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'List organisation members' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    listMembers(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.listMembers(uuid, userUuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION_MEMBER, action: ActivityAction.MEMBER_ROLE_UPDATED, entityUuidFrom: 'params.userUuid', organisationUuidFrom: 'params.uuid' })
    @Patch(':uuid/members/:userUuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Update member role' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    updateMemberRole(
        @Param('uuid') uuid: string,
        @Param('userUuid') targetUserUuid: string,
        @CurrentUser('uuid') actorUuid: string,
        @Body() dto: UpdateMemberRoleDto,
    ) {
        return this.organisationsService.updateMemberRole(
            uuid,
            actorUuid,
            targetUserUuid,
            dto,
        );
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION_MEMBER, action: ActivityAction.MEMBER_REMOVED, entityUuidFrom: 'params.userUuid', organisationUuidFrom: 'params.uuid' })
    @Delete(':uuid/members/:userUuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Remove member' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    removeMember(
        @Param('uuid') uuid: string,
        @Param('userUuid') targetUserUuid: string,
        @CurrentUser('uuid') actorUuid: string,
    ) {
        return this.organisationsService.removeMember(uuid, actorUuid, targetUserUuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION_INVITATION, action: ActivityAction.INVITATION_CREATED, organisationUuidFrom: 'params.uuid' })
    @Post(':uuid/invitations')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Invite a user by email' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Organisation not found' })
    createInvitation(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') actorUuid: string,
        @Body() dto: CreateInvitationDto,
    ) {
        return this.organisationsService.createInvitation(uuid, actorUuid, dto);
    }

    @Get(':uuid/invitations')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'List pending invitations' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    listInvitations(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') actorUuid: string,
    ) {
        return this.organisationsService.listInvitations(uuid, actorUuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION_INVITATION, action: ActivityAction.INVITATION_RESENT, entityUuidFrom: 'params.invitationUuid', organisationUuidFrom: 'params.uuid' })
    @Post(':uuid/invitations/:invitationUuid/resend')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Resend invitation email' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Invitation not found' })
    resendInvitation(
        @Param('uuid') uuid: string,
        @Param('invitationUuid') invitationUuid: string,
        @CurrentUser('uuid') actorUuid: string,
    ) {
        return this.organisationsService.resendInvitation(
            uuid,
            actorUuid,
            invitationUuid,
        );
    }

    @ActivityLog({ entityType: ActivityEntityType.ORGANISATION_INVITATION, action: ActivityAction.INVITATION_REVOKED, entityUuidFrom: 'params.invitationUuid', organisationUuidFrom: 'params.uuid' })
    @Delete(':uuid/invitations/:invitationUuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Revoke invitation' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Invitation not found' })
    revokeInvitation(
        @Param('uuid') uuid: string,
        @Param('invitationUuid') invitationUuid: string,
        @CurrentUser('uuid') actorUuid: string,
    ) {
        return this.organisationsService.revokeInvitation(
            uuid,
            actorUuid,
            invitationUuid,
        );
    }
}
