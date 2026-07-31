import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateIntegrationAccountDto {
    @ApiProperty({ example: 'Sales Gmail' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    title!: string;
}
