import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class StartCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sender_profile_uuid?: string;
}

export class SendCampaignDraftsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sender_profile_uuid?: string;
}
