import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class PublicSendEmailDto {
    @ApiProperty()
    @IsUUID()
    contact_uuid: string;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    content: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(255)
    subject?: string;

    @ApiPropertyOptional({ description: 'ISO datetime for delayed sending' })
    @IsOptional()
    @IsDateString()
    scheduled_at?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    sender_profile_uuid?: string;

    @ApiPropertyOptional({
        description: 'List this send should be attributed to for list-scoped status tracking',
    })
    @IsOptional()
    @IsUUID()
    list_uuid?: string;
}
