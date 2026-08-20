import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSequenceDto {
    @ApiProperty({ minLength: 1, maxLength: 120 })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;
}
