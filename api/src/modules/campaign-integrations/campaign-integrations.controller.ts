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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { CampaignIntegrationsService } from './services/campaign-integrations.service';
import { AssignCampaignIntegrationDto } from './dto/assign-campaign-integration.dto';
import { UpdateCampaignIntegrationStatusDto } from './dto/update-campaign-integration-status.dto';

@ApiTags('campaign-integrations')
@ApiBearerAuth()
@ApiParam({ name: 'campaign_uuid', description: 'Marketing campaign uuid' })
@UseGuards(JwtGuard, OrganisationRolesGuard)
@Controller('marketing-campaigns/:campaign_uuid/integrations')
export class CampaignIntegrationsController {
  constructor(
    private readonly campaignIntegrationsService: CampaignIntegrationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the sending integrations assigned to a campaign',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  list(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('campaign_uuid') campaign_uuid: string,
  ) {
    return this.campaignIntegrationsService.list(
      organisation_uuid,
      campaign_uuid,
    );
  }

  @ActivityLog({
    entityType: ActivityEntityType.CAMPAIGN_INTEGRATION,
    action: ActivityAction.ASSIGNED,
    entityUuidFrom: 'result.uuid',
  })
  @Post()
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({
    summary: 'Assign an email account + sending policy to a campaign',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — organisation admin role required' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  assign(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('campaign_uuid') campaign_uuid: string,
    @Body() dto: AssignCampaignIntegrationDto,
  ) {
    return this.campaignIntegrationsService.assign(
      organisation_uuid,
      campaign_uuid,
      dto,
    );
  }

  @ActivityLog({
    entityType: ActivityEntityType.CAMPAIGN_INTEGRATION,
    action: ActivityAction.UPDATED,
    entityUuidFrom: 'params.ci_uuid',
  })
  @Patch(':ci_uuid')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({ summary: 'Pause or resume a campaign integration' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — organisation admin role required' })
  @ApiResponse({ status: 404, description: 'Campaign or campaign integration not found' })
  updateStatus(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('campaign_uuid') campaign_uuid: string,
    @Param('ci_uuid') ci_uuid: string,
    @Body() dto: UpdateCampaignIntegrationStatusDto,
  ) {
    return this.campaignIntegrationsService.updateStatus(
      organisation_uuid,
      campaign_uuid,
      ci_uuid,
      dto,
    );
  }

  @ActivityLog({
    entityType: ActivityEntityType.CAMPAIGN_INTEGRATION,
    action: ActivityAction.REMOVED,
    entityUuidFrom: 'params.ci_uuid',
  })
  @Delete(':ci_uuid')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({
    summary:
      'Remove a campaign integration (soft - keeps history for observability)',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — organisation admin role required' })
  @ApiResponse({ status: 404, description: 'Campaign or campaign integration not found' })
  remove(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('campaign_uuid') campaign_uuid: string,
    @Param('ci_uuid') ci_uuid: string,
  ) {
    return this.campaignIntegrationsService.remove(
      organisation_uuid,
      campaign_uuid,
      ci_uuid,
    );
  }

  @Get('activity')
  @ApiOperation({
    summary:
      'Real per-day send counts per campaign integration, for the sending-schedule calendar view',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  getSendingActivity(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('campaign_uuid') campaign_uuid: string,
  ) {
    return this.campaignIntegrationsService.getSendingActivity(
      organisation_uuid,
      campaign_uuid,
    );
  }

  @Get(':ci_uuid/capacity')
  @ApiOperation({
    summary:
      'Observability: effective capacity, usage, and next eligible send time',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Campaign or campaign integration not found' })
  getCapacity(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('campaign_uuid') campaign_uuid: string,
    @Param('ci_uuid') ci_uuid: string,
  ) {
    return this.campaignIntegrationsService.getCapacity(
      organisation_uuid,
      campaign_uuid,
      ci_uuid,
    );
  }
}
