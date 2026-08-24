import { ApiPropertyOptional } from '@nestjs/swagger';
import { Channel, ExternalIntegrationProvider, MsgStatus } from '@/generated/prisma';
import { Transform, Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

export const SendSource = {
    DIRECT: 'direct',
    CAMPAIGN: 'campaign',
    SEQUENCE: 'sequence',
} as const;

export type SendSourceType = (typeof SendSource)[keyof typeof SendSource];

export class ListMessagesDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    contact_uuid?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    campaign_uuid?: string;

    @ApiPropertyOptional({ enum: MsgStatus })
    @IsOptional()
    @IsEnum(MsgStatus)
    status?: MsgStatus;

    @ApiPropertyOptional({ enum: Channel })
    @IsOptional()
    @IsEnum(Channel)
    channel?: Channel;

    @ApiPropertyOptional({ enum: SendSource })
    @IsOptional()
    @IsIn([SendSource.DIRECT, SendSource.CAMPAIGN, SendSource.SEQUENCE])
    source?: SendSourceType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    sequence_uuid?: string;

    @ApiPropertyOptional({ enum: ExternalIntegrationProvider })
    @IsOptional()
    @IsIn([ExternalIntegrationProvider.RESEND, ExternalIntegrationProvider.SMTP])
    email_provider?: ExternalIntegrationProvider;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    email_account?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    email_domain_uuid?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    sent_by_user_uuid?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    date_from?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    date_to?: string;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    history_only?: boolean;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}
