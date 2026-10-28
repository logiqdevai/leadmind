import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEmail,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

/** Field rules mirror CreateContactDto so auto-created contacts always pass contact validation. */
export class PublicCreateBookingDto {
    @ApiProperty({ description: 'ISO 8601 start instant of the chosen slot' })
    @IsDateString()
    start_at: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(5)
    @Max(720)
    duration_minutes?: number;

    @ApiProperty({ example: 'Europe/Athens' })
    @IsString()
    @MaxLength(64)
    timezone: string;

    @ApiProperty({ maxLength: 200 })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiPropertyOptional({ description: 'Required on generic links; contact links fall back to the contact email' })
    @IsOptional()
    @IsEmail()
    @MaxLength(320)
    email?: string;

    @ApiPropertyOptional({ maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    phone?: string;

    @ApiPropertyOptional({ maxLength: 200, description: 'Company name; saved on the linked contact when it has none' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    company?: string;

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;

    @ApiPropertyOptional({ description: 'Answers to page questions keyed by question id' })
    @IsOptional()
    @IsObject()
    answers?: Record<string, string | boolean>;

    @ApiPropertyOptional({ format: 'uuid', description: 'Only honoured when the page allows invitees to pick a member' })
    @IsOptional()
    @IsUUID()
    member_uuid?: string;
}

export class PublicRescheduleBookingDto {
    @ApiProperty({ description: 'ISO 8601 start instant' })
    @IsDateString()
    start_at: string;

    @ApiPropertyOptional({ example: 'Europe/Athens' })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    timezone?: string;
}

export class PublicCancelBookingDto {
    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    reason?: string;
}
