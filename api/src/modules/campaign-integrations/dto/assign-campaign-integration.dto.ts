import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignCampaignIntegrationDto {
  @ApiProperty({ description: 'IntegrationAccount to send this campaign from' })
  @IsUUID()
  integration_account_uuid!: string;

  @ApiPropertyOptional({
    description:
      'Domain/from-email (of the chosen account) to send this campaign from. Defaults to the account default domain when omitted.',
  })
  @IsOptional()
  @IsUUID()
  integration_account_domain_uuid?: string;

  @ApiProperty({ description: 'SendingPolicy template to clone and assign' })
  @IsUUID()
  sending_policy_uuid!: string;
}
