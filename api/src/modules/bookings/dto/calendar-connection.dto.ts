import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCalendarConnectionDto {
    @ApiPropertyOptional({ description: 'Google calendar id events are written to (from /calendars)' })
    @IsOptional()
    @IsString()
    @MaxLength(320)
    calendar_id?: string;

    @ApiPropertyOptional({ description: 'Treat busy time in this calendar as unavailable' })
    @IsOptional()
    @IsBoolean()
    check_conflicts?: boolean;
}

export class VerifyCalendarConnectionDto {
    @ApiProperty({ description: 'connected_account_id query parameter Composio appended to the callback URL' })
    @IsString()
    @MaxLength(200)
    connected_account_id: string;
}
