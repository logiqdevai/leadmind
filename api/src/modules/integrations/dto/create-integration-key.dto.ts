import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationKeyType } from '@/generated/prisma';
import {
    IsEnum,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateIntegrationKeyDto {
    @ApiProperty({ enum: IntegrationKeyType, example: IntegrationKeyType.API_KEY })
    @IsEnum(IntegrationKeyType)
    key_type!: IntegrationKeyType;

    @ApiProperty({
        example: '1',
        description:
            'Account label shared by related keys, e.g. RESEND_API_KEY_1 and RESEND_WEBHOOK_SECRET_1 both use account "1".',
    })
    @IsString()
    @MinLength(1)
    @MaxLength(32)
    @Matches(/^[a-zA-Z0-9_-]+$/)
    account!: string;

    @ApiPropertyOptional({
        example: 'Marketing Resend',
        description:
            'Display title for this account. Required when creating the first key for a new multi-account integration account.',
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    title?: string;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    secret!: string;
}
