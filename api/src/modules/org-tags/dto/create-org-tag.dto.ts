import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOrgTagDto {
    @ApiProperty({ maxLength: 60, description: 'Tag name, unique per organisation (case-insensitive), e.g. "Real estate"' })
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    name: string;

    @ApiPropertyOptional({ description: 'Hex colour used for the tag chip, e.g. #3b82f6' })
    @IsOptional()
    @IsHexColor()
    color?: string;
}
