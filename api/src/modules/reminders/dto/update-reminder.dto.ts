import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';
import { ReminderStatus } from '@/generated/prisma';

export class UpdateReminderDto {
    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;

    @ApiPropertyOptional({ description: 'ISO 8601 datetime string' })
    @IsOptional()
    @IsDateString()
    remind_at?: string;

    @ApiPropertyOptional({ enum: ReminderStatus })
    @IsOptional()
    @IsEnum(ReminderStatus)
    status?: ReminderStatus;

    @ApiPropertyOptional({
        type: [String],
        format: 'uuid',
        description: 'Replaces the assignees. Empty array: every member of the organisation. Omitted: unchanged.',
    })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @ArrayMaxSize(100)
    @IsUUID('4', { each: true })
    assignee_user_uuids?: string[];

    @ApiPropertyOptional({
        description:
            "true: add to (or keep on) your connected Google Calendar. false: remove it from there. Omitted: unchanged.",
    })
    @IsOptional()
    @IsBoolean()
    add_to_google_calendar?: boolean;
}
