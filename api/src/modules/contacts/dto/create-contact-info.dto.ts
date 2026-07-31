import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
    CONTACT_INFO_TYPES,
    type ContactInfoTypeValue,
} from '../constants/contact-info-types.constants';

export class CreateContactInfoDto {
    @ApiProperty({ enum: CONTACT_INFO_TYPES, example: 'EMAIL' })
    @IsIn([...CONTACT_INFO_TYPES])
    type: ContactInfoTypeValue;

    @ApiProperty({ minLength: 1, maxLength: 2000, example: 'info@azioweb.com' })
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    value: string;
}
