import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CampaignIntegrationsService } from './services/campaign-integrations.service';

@ApiTags('campaign-integrations')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('campaign-integrations')
export class CampaignIntegrationsBrowseController {
  constructor(
    private readonly campaignIntegrationsService: CampaignIntegrationsService,
  ) {}

  @Get()
  @ApiQuery({ name: 'exclude_campaign_uuid', required: false, description: 'Campaign uuid to omit from the results' })
  @ApiOperation({
    summary:
      "List sending integrations assigned across the organisation's campaigns - used to copy another campaign's sending policy",
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  listForOrganisation(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Query('exclude_campaign_uuid') exclude_campaign_uuid?: string,
  ) {
    return this.campaignIntegrationsService.listForOrganisation(
      organisation_uuid,
      exclude_campaign_uuid,
    );
  }
}
