import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password', example: 'password123' })
    @IsString()
    @MinLength(1)
    current_password: string;

    @ApiProperty({ description: 'New password (minimum 6 characters)', example: 'newpassword123', minLength: 6 })
    @IsString()
    @MinLength(6)
    new_password: string;
}
