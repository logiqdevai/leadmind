import { ApiPropertyOptional } from '@nestjs/swagger';
import { Channel, ExternalIntegrationProvider, MsgStatus, ThreadOrigin } from '@/generated/prisma';
import { Type } from 'class-transformer';
import {
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

export class ListThreadContactsDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: Channel })
    @IsOptional()
    @IsEnum(Channel)
    channel?: Channel;

    @ApiPropertyOptional({ enum: ThreadOrigin })
    @IsOptional()
    @IsEnum(ThreadOrigin)
    source?: ThreadOrigin;

    @ApiPropertyOptional({ enum: MsgStatus })
    @IsOptional()
    @IsEnum(MsgStatus)
    status?: MsgStatus;

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
    sent_by_user_uuid?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    campaign_uuid?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    sequence_uuid?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    date_from?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    date_to?: string;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 25;
}
