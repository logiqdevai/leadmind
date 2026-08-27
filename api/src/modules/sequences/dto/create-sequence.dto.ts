import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

    @ApiPropertyOptional({
        description:
            'Automatically cancel a contact enrollment (skipping remaining steps) once they reply. Defaults to true.',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    stop_on_reply?: boolean;
}
