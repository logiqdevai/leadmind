import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsEmail,
    IsISO31661Alpha2,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    MaxLength,
    ValidateIf,
} from 'class-validator';

export class CreateContactDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    filter_uuid?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    @MaxLength(320)
    email?: string;

    @ApiPropertyOptional({ maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    phone?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    company?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUrl({ require_protocol: false })
    @MaxLength(500)
    website?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUrl({ require_protocol: false })
    @MaxLength(500)
    google_maps_url?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    location?: string;

    @ApiPropertyOptional({
        nullable: true,
        example: 'GR',
        description: 'ISO 3166-1 alpha-2 country code. Null clears it on update.',
    })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    @ValidateIf((_, value) => value !== null)
    @IsISO31661Alpha2()
    country?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUrl({ require_protocol: false })
    @MaxLength(500)
    linkedin_url?: string;

    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    industry?: string;

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @ArrayUnique()
    tags?: string[];

    @ApiPropertyOptional({ maxLength: 5000 })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;

    @ApiPropertyOptional({
        type: [String],
        format: 'uuid',
        description: 'Optional list memberships to add for the new contact.',
    })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    list_uuids?: string[];
}
