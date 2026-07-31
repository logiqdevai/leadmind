import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsInt,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { GoalPeriod } from '@/generated/prisma';

class BulkGoalItemDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    user_uuid: string;

    @ApiProperty({ enum: GoalPeriod })
    @IsEnum(GoalPeriod)
    period: GoalPeriod;

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
