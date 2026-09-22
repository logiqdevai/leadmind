import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrganisationRole } from '@/generated/prisma';

export class UpdateApiKeyDto {
    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ enum: OrganisationRole })
    @IsOptional()
    @IsEnum(OrganisationRole)
    organisation_role?: OrganisationRole;

    @ApiPropertyOptional({ description: 'ISO 8601 datetime string' })
    @IsOptional()
    @IsDateString()
    expires_at?: string;
}
