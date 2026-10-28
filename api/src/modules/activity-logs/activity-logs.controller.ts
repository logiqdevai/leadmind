import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityUndoService } from './activity-undo.service';
import { ListActivityLogsDto } from './dto/list-activity-logs.dto';

@ApiTags('activity-logs')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('activity-logs')
export class ActivityLogsController {
    constructor(
        private readonly activityLogsService: ActivityLogsService,
        private readonly activityUndoService: ActivityUndoService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'List organisation activity logs' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ListActivityLogsDto,
    ) {
        return this.activityLogsService.findAll(organisation_uuid, query);
    }

    @Post(':uuid/undo')
    @UseGuards(OrganisationRolesGuard)
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({
        summary: 'Undo a logged action',
        description:
            'Reverts an edit, restores a deleted row or removes a created one. Requires the organisation admin role. ' +
            'Fails with 409 when the row was changed again since, or already exists/was removed.',
    })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 400, description: 'This action cannot be undone' })
    @ApiResponse({ status: 403, description: 'Forbidden — organisation admin role required' })
    @ApiResponse({ status: 404, description: 'Activity not found' })
    @ApiResponse({ status: 409, description: 'Already undone, or the row changed since' })
    undo(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.activityUndoService.undo(organisation_uuid, uuid, user_uuid);
    }
}
