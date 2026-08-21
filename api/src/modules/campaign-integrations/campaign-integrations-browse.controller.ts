import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
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
  @ApiQuery({ name: 'exclude_campaign_uuid', required: false })
  @ApiOperation({
    summary:
      "List sending integrations assigned across the organisation's campaigns - used to copy another campaign's sending policy",
  })
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
