import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import {
    Channel,
    SequenceDelayReference,
    SequenceDelayUnit,
} from '@/generated/prisma';

export const SEQUENCE_STEP_CHANNELS = [Channel.EMAIL, Channel.SMS] as const;

export class CreateSequenceStepDto {
    @ApiProperty({ enum: SEQUENCE_STEP_CHANNELS })
    @IsIn(SEQUENCE_STEP_CHANNELS)
    channel!: Channel;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    email_subject?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    email_content?: string;

    @ApiPropertyOptional({ maxLength: 1600 })
    @IsOptional()
    @IsString()
    @MaxLength(1600)
    sms_content?: string;

    @ApiPropertyOptional({
        description:
            'MessageTemplate this step content was copied from (provenance only)',
    })
    @IsOptional()
    @IsUUID()
    message_template_uuid?: string;

    @ApiProperty({ minimum: 0 })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    delay_value!: number;

    @ApiProperty({ enum: SequenceDelayUnit })
    @IsEnum(SequenceDelayUnit)
    delay_unit!: SequenceDelayUnit;

    @ApiProperty({ enum: SequenceDelayReference })
    @IsEnum(SequenceDelayReference)
    delay_reference!: SequenceDelayReference;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;
}
