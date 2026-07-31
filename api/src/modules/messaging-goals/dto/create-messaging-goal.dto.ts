import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsUUID, Min } from 'class-validator';
import { GoalPeriod } from '@/generated/prisma';

export class CreateMessagingGoalDto {
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
