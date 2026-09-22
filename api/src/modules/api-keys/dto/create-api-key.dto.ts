import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrganisationRole } from '@/generated/prisma';

export class CreateApiKeyDto {
    @ApiProperty({ maxLength: 200, description: 'A label to identify this key, e.g. "Zapier integration"' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiPropertyOptional({ enum: OrganisationRole, default: OrganisationRole.MEMBER })
    @IsOptional()
    @IsEnum(OrganisationRole)
    organisation_role?: OrganisationRole;

    @ApiPropertyOptional({ description: 'ISO 8601 datetime string; omit for a key that never expires' })
    @IsOptional()
    @IsDateString()
    expires_at?: string;
}
