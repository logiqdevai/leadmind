import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';
import { EmailSendLimitsService } from './email-send-limits.service';
import { UpsertEmailSendLimitDto } from './dto/upsert-email-send-limit.dto';

@ApiTags('email-send-limits')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('email-send-limits')
export class EmailSendLimitsController {
    constructor(private readonly emailSendLimitsService: EmailSendLimitsService) {}

    @Get()
    @ApiOperation({ summary: 'List email send limits and current usage for configured integrations' })
    list(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.emailSendLimitsService.list(organisation_uuid);
    }

    @ActivityLog({
        entityType: ActivityEntityType.EMAIL_SEND_LIMIT,
        action: ActivityAction.UPDATED,
        entityUuidFrom: 'none',
    })
    @Put()
    @UseGuards(OrganisationRolesGuard)
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Create or update a send limit for an email provider and period' })
    upsert(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: UpsertEmailSendLimitDto,
    ) {
        return this.emailSendLimitsService.upsert(organisation_uuid, dto);
    }

    @ActivityLog({
        entityType: ActivityEntityType.EMAIL_SEND_LIMIT,
        action: ActivityAction.DELETED,
        entityUuidFrom: 'params.uuid',
    })
    @Delete(':uuid')
    @UseGuards(OrganisationRolesGuard)
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Remove an email send limit' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.emailSendLimitsService.remove(organisation_uuid, uuid);
    }
}
