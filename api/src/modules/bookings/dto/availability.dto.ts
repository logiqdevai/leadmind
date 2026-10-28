import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsDateString,
    IsInt,
    Max,
    Min,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class TimeRangeDto {
    @ApiProperty({ example: '09:00' })
    @Matches(TIME_PATTERN, { message: 'start must be HH:MM' })
    start: string;

    @ApiProperty({ example: '12:00' })
    @Matches(TIME_PATTERN, { message: 'end must be HH:MM (24:00 allowed)' })
    end: string;
}

export class UpsertAvailabilityScheduleDto {
    @ApiProperty({ example: 'Europe/Athens', description: 'IANA timezone the working hours are written in' })
    @IsString()
    @MaxLength(64)
    timezone: string;

    @ApiProperty({
        description: 'ISO weekday ("1"=Mon .. "7"=Sun) -> working periods; gaps between periods are breaks',
        example: { '1': [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }], '6': [] },
    })
    @IsObject()
    weekly_hours: Record<string, TimeRangeDto[]>;
}

export class UpsertAvailabilityOverrideDto {
    @ApiProperty({ example: '2026-12-24', description: 'Date in the schedule timezone' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
    date: string;

    @ApiProperty({ type: [TimeRangeDto], description: 'Replacement working periods; empty = unavailable all day' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimeRangeDto)
    intervals: TimeRangeDto[];

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}

export class CreateBookingBlockDto {
    @ApiPropertyOptional({ format: 'uuid', description: 'Member to block; defaults to the current user' })
    @IsOptional()
    @IsUUID()
    user_uuid?: string;

    @ApiPropertyOptional({ description: 'Block every member (holidays). Admins only.' })
    @IsOptional()
    @IsBoolean()
    organisation_wide?: boolean;

    @ApiProperty({ description: 'ISO 8601 instant' })
    @IsDateString()
    start_at: string;

    @ApiProperty({ description: 'ISO 8601 instant' })
    @IsDateString()
    end_at: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}

export class UpdateBookingBlockDto {
    @ApiPropertyOptional({ description: 'ISO 8601 instant' })
    @IsOptional()
    @IsDateString()
    start_at?: string;

    @ApiPropertyOptional({ description: 'ISO 8601 instant' })
    @IsOptional()
    @IsDateString()
    end_at?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}

export class CreateRecurringBlockDto {
    @ApiPropertyOptional({ format: 'uuid', description: 'Member to block; defaults to the current user' })
    @IsOptional()
    @IsUUID()
    user_uuid?: string;

    @ApiPropertyOptional({ description: 'Block every member. Admins only.' })
    @IsOptional()
    @IsBoolean()
    organisation_wide?: boolean;

    @ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5], description: 'ISO weekdays, 1 = Monday .. 7 = Sunday' })
    @IsArray()
    @ArrayMinSize(1)
    @IsInt({ each: true })
    @Min(1, { each: true })
    @Max(7, { each: true })
    weekdays: number[];

    @ApiProperty({ example: '12:00' })
    @Matches(TIME_PATTERN, { message: 'start_time must be HH:MM' })
    start_time: string;

    @ApiProperty({ example: '13:00' })
    @Matches(TIME_PATTERN, { message: 'end_time must be HH:MM (24:00 allowed)' })
    end_time: string;

    @ApiProperty({ example: 'Europe/Athens', description: 'IANA timezone the times are written in' })
    @IsString()
    @MaxLength(64)
    timezone: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}

export class UpdateRecurringBlockDto {
    @ApiPropertyOptional({ type: [Number] })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @IsInt({ each: true })
    @Min(1, { each: true })
    @Max(7, { each: true })
    weekdays?: number[];

    @ApiPropertyOptional()
    @IsOptional()
    @Matches(TIME_PATTERN, { message: 'start_time must be HH:MM' })
    start_time?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Matches(TIME_PATTERN, { message: 'end_time must be HH:MM (24:00 allowed)' })
    end_time?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}

export class ListRecurringBlocksDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    user_uuid?: string;
}

export class ListBookingBlocksDto {
    @ApiProperty({ description: 'ISO 8601 instant' })
    @IsDateString()
    from: string;

    @ApiProperty({ description: 'ISO 8601 instant' })
    @IsDateString()
    to: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    user_uuid?: string;
}
