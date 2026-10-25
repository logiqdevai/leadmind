import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBookingLinkDto {
    @ApiPropertyOptional({ maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    label?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    auto_create_contact?: boolean;

    @ApiPropertyOptional({ description: 'false deactivates the link; its URL stops accepting bookings' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
