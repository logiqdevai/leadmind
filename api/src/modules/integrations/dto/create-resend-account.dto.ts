import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateResendAccountDto {
    @ApiProperty({ example: '1' })
    @IsString()
    @Matches(/^[a-zA-Z0-9_-]+$/)
    account!: string;

    @ApiProperty({ example: 'Marketing Resend', description: 'Display title shown in send menus' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    title!: string;

    @ApiProperty({ example: 're_...' })
    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    api_key!: string;

    @ApiPropertyOptional({ example: 'whsec_...' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    webhook_secret?: string;

    @ApiProperty({ example: 'noreply@example.com', description: 'First sending domain/from-email for this account' })
    @IsEmail()
    from_email!: string;

    @ApiPropertyOptional({ example: 'Acme Sales' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    from_name?: string;
}
