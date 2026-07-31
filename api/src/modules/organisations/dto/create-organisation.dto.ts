import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsIn,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
    ValidateIf,
} from 'class-validator';
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

    @ApiPropertyOptional({
        example: 'replies@acme.com',
        description: 'Inbox that receives replies to outreach emails (Reply-To)',
        nullable: true,
    })
    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'string' && value.trim() === '' ? null : value,
    )
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsEmail()
    @MaxLength(320)
    reply_to_email?: string | null;
}
