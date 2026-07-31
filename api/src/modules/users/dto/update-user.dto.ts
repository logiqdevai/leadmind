import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiPropertyOptional({ description: 'Full display name', example: 'Jane Doe' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    full_name?: string;

    @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+1234567890', nullable: true })
    @IsOptional()
    @IsString()
    phone?: string | null;
}
