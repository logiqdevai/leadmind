import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { BookingLocationType, BookingStatus } from '@/generated/prisma';

export class UpdateBookingDto {
    @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(200) invitee_name?: string;
    @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(320) invitee_email?: string;
    @ApiPropertyOptional({ maxLength: 50 }) @IsOptional() @IsString() @MaxLength(50) invitee_phone?: string;
    @ApiPropertyOptional({ maxLength: 5000 }) @IsOptional() @IsString() @MaxLength(5000) invitee_notes?: string;
    @ApiPropertyOptional({ maxLength: 10000 }) @IsOptional() @IsString() @MaxLength(10000) internal_notes?: string;
    @ApiPropertyOptional({ enum: BookingLocationType }) @IsOptional() @IsEnum(BookingLocationType) location_type?: BookingLocationType;
    @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) location_value?: string;
}

export class RescheduleBookingDto {
    @ApiProperty({ description: 'New ISO 8601 start instant (duration is kept)' })
    @IsDateString()
    start_at: string;

    @ApiPropertyOptional({ format: 'uuid', description: 'Move to another member at the same time' })
    @IsOptional()
    @IsUUID()
    assigned_user_uuid?: string;

    @ApiPropertyOptional({ description: 'Ignore working hours / rules. Double bookings are still prevented.' })
    @IsOptional()
    @IsBoolean()
    ignore_availability?: boolean;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    notify?: boolean;
}

export class CancelBookingDto {
    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    reason?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    notify?: boolean;
}

export const SETTABLE_BOOKING_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW] as const;

export class UpdateBookingStatusDto {
    @ApiProperty({ enum: SETTABLE_BOOKING_STATUSES, description: 'Use /cancel and /reschedule for those transitions' })
    @IsIn(SETTABLE_BOOKING_STATUSES)
    status: (typeof SETTABLE_BOOKING_STATUSES)[number];
}

export class AssignBookingDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    assigned_user_uuid: string;

    @ApiPropertyOptional({ description: 'Assign even if outside the member\'s working hours' })
    @IsOptional()
    @IsBoolean()
    ignore_availability?: boolean;
}
