import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ExternalIntegrationProvider, GoalPeriod } from '@/generated/prisma';
import { EMAIL_SEND_LIMIT_PROVIDERS } from '../constants/email-send-limits.constants';

export class UpsertEmailSendLimitDto {
    @ApiProperty({ enum: EMAIL_SEND_LIMIT_PROVIDERS })
    @IsIn(EMAIL_SEND_LIMIT_PROVIDERS)
    provider: ExternalIntegrationProvider;

    @ApiProperty({ enum: GoalPeriod })
    @IsIn(Object.values(GoalPeriod))
    period: GoalPeriod;

    @ApiProperty({ minimum: 1 })
    @IsInt()
    @Min(1)
    max_count: number;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
