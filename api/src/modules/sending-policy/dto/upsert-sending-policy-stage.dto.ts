import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { SendingPeriodUnit } from '@/generated/prisma';

export class UpsertSendingPolicyStageDto {
  @ApiProperty({ minimum: 1, description: 'Messages allowed per period_unit' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit!: number;

  @ApiProperty({ enum: SendingPeriodUnit })
  @IsEnum(SendingPeriodUnit)
  period_unit!: SendingPeriodUnit;

  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Omit together with duration_unit to make this the final/indefinite stage',
  })
  @IsOptional()
  @ValidateIf((o) => o.duration_value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration_value?: number;

  @ApiPropertyOptional({ enum: SendingPeriodUnit })
  @IsOptional()
  @ValidateIf((o) => o.duration_unit !== undefined)
  @IsEnum(SendingPeriodUnit)
  duration_unit?: SendingPeriodUnit;
}
