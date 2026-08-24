import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateIntegrationAccountDomainDto {
    @ApiPropertyOptional({ example: 'sales@example.com' })
    @IsOptional()
    @IsEmail()
    from_email?: string;

    @ApiPropertyOptional({ example: 'Acme Sales' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    from_name?: string;
}
