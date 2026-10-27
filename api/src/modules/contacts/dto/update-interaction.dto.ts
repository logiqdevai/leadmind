import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CallDirection, CallOutcome } from './log-call.dto';
import { MeetingOutcome } from './log-meeting.dto';

/**
 * Edit of a manually logged call, meeting, email or SMS. Every field is optional; the ones that
 * don't apply to the interaction's type are rejected by the service.
 */
export class UpdateInteractionDto {
    @ApiPropertyOptional({ description: 'Call outcome or meeting outcome, depending on the interaction type' })
    @IsOptional()
    @IsString()
    outcome?: CallOutcome | MeetingOutcome;

    @ApiPropertyOptional({ enum: CallDirection })
    @IsOptional()
    @IsEnum(CallDirection)
    direction?: CallDirection;

    @ApiPropertyOptional({ minimum: 0, maximum: 1440 })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1440)
    duration_minutes?: number;

    @ApiPropertyOptional({ description: 'When it happened (ISO datetime)' })
    @IsOptional()
    @IsISO8601()
    occurred_at?: string;

    @ApiPropertyOptional({ maxLength: 500, description: 'Meeting location' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    location?: string;

    @ApiPropertyOptional({ maxLength: 500, description: 'Email subject' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    subject?: string;

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    content?: string;
}
