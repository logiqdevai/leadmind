import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { BookingInviteUnit } from '@/generated/prisma';

export class SendBookingInvitationDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    contact_uuid: string;

    @ApiPropertyOptional({ format: 'uuid', description: 'Page to invite to; the contact\'s existing personal link is reused or created' })
    @IsOptional()
    @IsUUID()
    booking_page_uuid?: string;

    @ApiPropertyOptional({ format: 'uuid', description: 'Send this existing personal link of the contact instead of picking a page' })
    @IsOptional()
    @IsUUID()
    booking_link_uuid?: string;

    @ApiPropertyOptional({ description: 'Remind the contact if they have not booked. Defaults to the organisation setting' })
    @IsOptional()
    @IsBoolean()
    remind?: boolean;
}

export class ListBookingInvitationsDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    contact_uuid: string;
}

export class UpdateBookingInviteSettingsDto {
    @ApiPropertyOptional() @IsOptional() @IsBoolean() reminder_enabled?: boolean;

    @ApiPropertyOptional({ minimum: 1, maximum: 365 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(365)
    reminder_delay_value?: number;

    @ApiPropertyOptional({ enum: BookingInviteUnit })
    @IsOptional()
    @IsEnum(BookingInviteUnit)
    reminder_delay_unit?: BookingInviteUnit;

    @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Reminders per invitation' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    max_reminders?: number;

    @ApiPropertyOptional({ maxLength: 200, description: 'Empty restores the default' })
    @IsOptional() @IsString() @MaxLength(200) invite_subject?: string;
    @ApiPropertyOptional({ maxLength: 5000, description: 'Plain text; empty restores the default' })
    @IsOptional() @IsString() @MaxLength(5000) invite_message?: string;
    @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200) reminder_subject?: string;
    @ApiPropertyOptional({ maxLength: 5000 }) @IsOptional() @IsString() @MaxLength(5000) reminder_message?: string;

    @ApiPropertyOptional({ type: [String], description: 'Message templates for the invite email, one per language; replaces the full set. Empty uses the text above or the built-in default' })
    @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) invite_template_uuids?: string[];
    @ApiPropertyOptional({ type: [String], description: 'Message templates for the reminder email, one per language; replaces the full set' })
    @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) reminder_template_uuids?: string[];
}
