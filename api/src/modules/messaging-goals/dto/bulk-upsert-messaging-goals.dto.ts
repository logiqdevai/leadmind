import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { GoalMetric, GoalPeriod } from '@/generated/prisma';

class BulkGoalItemDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    user_uuid: string;

    @ApiProperty({ enum: GoalPeriod })
    @IsEnum(GoalPeriod)
    period: GoalPeriod;

    @ApiPropertyOptional({ enum: GoalMetric, default: GoalMetric.EMAIL })
    @IsOptional()
    @IsEnum(GoalMetric)
    metric?: GoalMetric;

    @ApiProperty({ minimum: 1 })
    @IsInt()
    @Min(1)
    target_count: number;
}

export class BulkUpsertMessagingGoalsDto {
    @ApiProperty({ type: [BulkGoalItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => BulkGoalItemDto)
    goals: BulkGoalItemDto[];
}
