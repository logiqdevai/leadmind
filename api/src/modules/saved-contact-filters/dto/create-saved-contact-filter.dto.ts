import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSavedContactFilterDto {
    @ApiProperty({ maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @ApiProperty({ type: 'object', additionalProperties: true })
    @IsObject()
    filters: Record<string, any>;
}
