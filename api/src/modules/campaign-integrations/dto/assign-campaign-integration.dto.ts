import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignCampaignIntegrationDto {
  @ApiProperty({ description: 'IntegrationAccount to send this campaign from' })
  @IsUUID()
  integration_account_uuid!: string;

  @ApiProperty({ description: 'SendingPolicy template to clone and assign' })
  @IsUUID()
  sending_policy_uuid!: string;
}
