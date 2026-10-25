import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { UpsertSendingPolicyStageDto } from './upsert-sending-policy-stage.dto';

export class CreateSendingPolicyDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1440,
    description:
      'Minutes since midnight the sending window opens; omit for no window',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  window_start_minute?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1440 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  window_end_minute?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description:
      'ISO weekdays (1=Mon ... 7=Sun) sending is allowed on, in the policy timezone. Defaults to all days; use [1,2,3,4,5] for weekdays only. Sends that would fall on another day are deferred (not dropped) to the next allowed day, still subject to the stage caps.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  allowed_weekdays?: number[];

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_interval_seconds?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_interval_jitter_seconds?: number;

  @ApiProperty({ type: [UpsertSendingPolicyStageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertSendingPolicyStageDto)
  stages!: UpsertSendingPolicyStageDto[];
}
