import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ReminderStatus } from '@/generated/prisma';

export class ListRemindersDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    contact_uuid?: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Reminders this member receives: assigned to them, or to everyone',
    })
    @IsOptional()
    @IsUUID()
    for_user_uuid?: string;

    @ApiPropertyOptional({ enum: ReminderStatus })
    @IsOptional()
    @IsEnum(ReminderStatus)
    status?: ReminderStatus;

    @ApiPropertyOptional({ enum: ['today', 'week', 'month', 'all', 'overdue'] })
    @IsOptional()
    @IsIn(['today', 'week', 'month', 'all', 'overdue'])
    range?: 'today' | 'week' | 'month' | 'all' | 'overdue';

    @ApiPropertyOptional({
        enum: ['closest', 'remind_at_asc', 'remind_at_desc'],
        default: 'remind_at_desc',
        description:
            "'closest' puts pending reminders nearest to the current time first (overdue or upcoming), then finished ones; otherwise ordered by remind_at.",
    })
    @IsOptional()
    @IsIn(['closest', 'remind_at_asc', 'remind_at_desc'])
    sort?: 'closest' | 'remind_at_asc' | 'remind_at_desc';

    @ApiPropertyOptional({
        example: 'Europe/Athens',
        description: "IANA timezone used for the 'today' range. Defaults to the organisation timezone.",
    })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Search by title, notes, or contact name/company/email' })
    @IsOptional()
    @IsString()
    search?: string;
}
