import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CreateOrganisationDto } from './create-organisation.dto';

export class UpdateOrganisationDto extends PartialType(CreateOrganisationDto) {
    @ApiPropertyOptional({ example: 'acme', description: 'URL slug used in public booking links' })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsString()
    @MinLength(2)
    @MaxLength(48)
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug may contain lowercase letters, digits and dashes' })
    slug?: string;
}
