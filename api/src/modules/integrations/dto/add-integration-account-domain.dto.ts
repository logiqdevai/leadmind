import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddIntegrationAccountDomainDto {
    @ApiProperty({ example: 'sales@example.com' })
    @IsEmail()
    from_email!: string;

    @ApiPropertyOptional({ example: 'Acme Sales' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    from_name?: string;

    @ApiPropertyOptional({ description: 'Set this domain as the account default' })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;
}
