import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSidebarFavoriteDto {
    @ApiProperty({ maxLength: 200 })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    nav_key: string;
}
