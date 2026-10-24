import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { GoalMetric, GoalPeriod } from '@/generated/prisma';

export class CreateMessagingGoalDto {
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
