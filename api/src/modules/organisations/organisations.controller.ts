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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('organisations')
@Controller('organisations')
export class OrganisationsController {
    constructor(private readonly organisationsService: OrganisationsService) {}

    @Get('invitations/:token')
    @ApiOperation({ summary: 'Preview an organisation invitation' })
    previewInvitation(@Param('token') token: string) {
        return this.organisationsService.previewInvitation(token);
    }

    @Post('invitations/:token/accept')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Accept an organisation invitation' })
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
    list(@CurrentUser('uuid') userUuid: string) {
        return this.organisationsService.listForUser(userUuid);
    }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Create a new organisation' })
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
    getCurrent(
        @CurrentUser('organisation_uuid') organisationUuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.getCurrent(organisationUuid, userUuid);
    }

    @Patch(':uuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Update organisation' })
    update(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') userUuid: string,
        @Body() dto: UpdateOrganisationDto,
    ) {
        return this.organisationsService.update(uuid, userUuid, dto);
    }

    @Delete(':uuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Delete organisation' })
    remove(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.remove(uuid, userUuid);
    }

    @Post(':uuid/switch')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Switch active organisation' })
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
    listMembers(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') userUuid: string,
    ) {
        return this.organisationsService.listMembers(uuid, userUuid);
    }

    @Patch(':uuid/members/:userUuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Update member role' })
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

    @Delete(':uuid/members/:userUuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Remove member' })
    removeMember(
        @Param('uuid') uuid: string,
        @Param('userUuid') targetUserUuid: string,
        @CurrentUser('uuid') actorUuid: string,
    ) {
        return this.organisationsService.removeMember(uuid, actorUuid, targetUserUuid);
    }

    @Post(':uuid/invitations')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Invite a user by email' })
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
    listInvitations(
        @Param('uuid') uuid: string,
        @CurrentUser('uuid') actorUuid: string,
    ) {
        return this.organisationsService.listInvitations(uuid, actorUuid);
    }

    @Delete(':uuid/invitations/:invitationUuid')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Revoke invitation' })
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
