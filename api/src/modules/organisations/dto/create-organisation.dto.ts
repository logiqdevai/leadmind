import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ORGANISATION_TIMEZONES } from '../constants/organisation-timezones';

export class CreateOrganisationDto {
    @ApiProperty({ example: 'Acme Inc' })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ example: 'Europe/Dublin', enum: ORGANISATION_TIMEZONES })
    @IsOptional()
    @IsString()
    @IsIn([...ORGANISATION_TIMEZONES])
    timezone?: string;
}
