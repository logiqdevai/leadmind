import { CallNoteStatus } from '@/generated/prisma';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEnum,
    IsISO8601,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export enum CallOutcome {
    CONNECTED = 'CONNECTED',
    NO_ANSWER = 'NO_ANSWER',
    VOICEMAIL = 'VOICEMAIL',
    BUSY = 'BUSY',
}

export enum CallDirection {
    OUTBOUND = 'OUTBOUND',
    INBOUND = 'INBOUND',
}

export class LogCallDto {
    @ApiPropertyOptional({
        enum: CallNoteStatus,
        description: 'What the call came to (the Quick note choice); stored so calls can be counted by outcome',
    })
    @IsOptional()
    @IsEnum(CallNoteStatus)
    note_status?: CallNoteStatus;

    @ApiProperty({ enum: CallOutcome })
    @IsEnum(CallOutcome)
    outcome: CallOutcome;

    @ApiProperty({ enum: CallDirection, default: CallDirection.OUTBOUND })
    @IsEnum(CallDirection)
    direction: CallDirection;

    @ApiPropertyOptional({ description: 'Whether we got past the gatekeeper and spoke with the owner' })
    @IsOptional()
    @IsBoolean()
    reached_owner?: boolean;

    @ApiPropertyOptional({ minimum: 0, maximum: 1440 })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1440)
    duration_minutes?: number;

    @ApiPropertyOptional({ description: 'When the call occurred (ISO datetime). Defaults to now.' })
    @IsOptional()
    @IsISO8601()
    occurred_at?: string;

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    content?: string;
}
