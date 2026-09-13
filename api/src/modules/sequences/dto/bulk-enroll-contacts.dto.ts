import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { EMAIL_DELIVERY_PROVIDERS, EmailDeliveryProvider } from '@/modules/outreach/dto/email-provider.dto';

export class BulkEnrollContactsDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('all', { each: true })
    contact_uuids!: string[];

    @ApiPropertyOptional({
        description: 'The contact list this enrollment was launched from, if any',
    })
    @IsOptional()
    @IsUUID()
    list_uuid?: string;

    @ApiPropertyOptional({
        enum: EMAIL_DELIVERY_PROVIDERS,
        description: 'Which mailbox to send this sequence\'s email steps from. Defaults to the org default account.',
    })
    @IsOptional()
    @IsIn(EMAIL_DELIVERY_PROVIDERS)
    email_provider?: EmailDeliveryProvider;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(1)
    email_account?: string;

    @ApiPropertyOptional({
        description: 'RESEND only - which domain/from-email to send from. Defaults to the account default domain.',
    })
    @IsOptional()
    @IsUUID()
    email_domain_uuid?: string;
}
