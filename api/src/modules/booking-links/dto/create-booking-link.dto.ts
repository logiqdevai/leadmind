import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBookingLinkDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    booking_page_uuid: string;

    @ApiPropertyOptional({ format: 'uuid', description: 'Set for a contact-specific link; omit for a generic link' })
    @IsOptional()
    @IsUUID()
    contact_uuid?: string;

    @ApiPropertyOptional({ maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    label?: string;

    @ApiPropertyOptional({ description: 'Generic links only: create or match a contact from the invitee details' })
    @IsOptional()
    @IsBoolean()
    auto_create_contact?: boolean;
}
