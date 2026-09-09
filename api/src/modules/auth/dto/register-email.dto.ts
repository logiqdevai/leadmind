// src/modules/auth/dto/register-email.dto.ts

import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterEmailDto {
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
        format: 'email',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Full display name',
        example: 'Jane Doe',
    })
    @IsString()
    @MinLength(1)
    full_name: string;

    @ApiProperty({
        description: 'User password (minimum 6 characters)',
        example: 'password123',
        minLength: 6,
    })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiPropertyOptional({
        description: 'Pending organisation invitation token - if valid and the email matches, the new account joins that organisation instead of getting its own',
    })
    @IsOptional()
    @IsString()
    invite_token?: string;
}
