import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const CAMPAIGN_INTEGRATION_SETTABLE_STATUSES = [
  'ACTIVE',
  'PAUSED',
] as const;

export class UpdateCampaignIntegrationStatusDto {
  @ApiProperty({ enum: CAMPAIGN_INTEGRATION_SETTABLE_STATUSES })
  @IsIn(CAMPAIGN_INTEGRATION_SETTABLE_STATUSES)
  status!: (typeof CAMPAIGN_INTEGRATION_SETTABLE_STATUSES)[number];
}
