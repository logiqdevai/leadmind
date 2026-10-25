import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEmail,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';
import { BookingLocationType } from '@/generated/prisma';

/** Manual booking created by a team member. Either an existing contact or invitee details. */
export class CreateBookingDto {
    @ApiPropertyOptional({ format: 'uuid', description: 'Booking page whose rules, team and notifications apply' })
    @IsOptional()
    @IsUUID()
    booking_page_uuid?: string;

    @ApiPropertyOptional({ format: 'uuid', description: 'Existing contact; invitee details default to theirs' })
    @IsOptional()
    @IsUUID()
    contact_uuid?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @ValidateIf((o) => !o.contact_uuid)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    invitee_name?: string;

    @ApiPropertyOptional()
    @ValidateIf((o) => !o.contact_uuid)
    @IsEmail()
    @MaxLength(320)
    invitee_email?: string;

    @ApiPropertyOptional({ maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    invitee_phone?: string;

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    invitee_notes?: string;

    @ApiPropertyOptional({ example: 'Europe/Athens' })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    invitee_timezone?: string;

    @ApiProperty({ description: 'ISO 8601 start instant' })
    @IsDateString()
    start_at: string;

    @ApiPropertyOptional({ description: 'Defaults to the page duration (or 30)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(5)
    @Max(720)
    duration_minutes?: number;

    @ApiPropertyOptional({ format: 'uuid', description: 'Team member; auto-assigned from page members when omitted' })
    @IsOptional()
    @IsUUID()
    assigned_user_uuid?: string;

    @ApiPropertyOptional({ enum: BookingLocationType, description: 'Defaults to the page location' })
    @IsOptional()
    @IsEnum(BookingLocationType)
    location_type?: BookingLocationType;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    location_value?: string;

    @ApiPropertyOptional({ maxLength: 10000 })
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    internal_notes?: string;

    @ApiPropertyOptional({ description: 'Book outside working hours / scheduling rules. Double bookings are still prevented.' })
    @IsOptional()
    @IsBoolean()
    ignore_availability?: boolean;

    @ApiPropertyOptional({ default: true, description: 'Send the page notifications (confirmation, reminders)' })
    @IsOptional()
    @IsBoolean()
    notify?: boolean;

    @ApiPropertyOptional({ description: 'Answers to page questions keyed by question id' })
    @IsOptional()
    @IsObject()
    answers?: Record<string, string | boolean>;
}
