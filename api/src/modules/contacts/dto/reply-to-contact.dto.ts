import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReplyToContactDto {
    @ApiProperty({
        format: 'uuid',
        description: 'The outreach message whose conversation thread is being replied to',
    })
    @IsUUID()
    outreach_message_uuid: string;

    @ApiPropertyOptional({ maxLength: 255, description: 'Defaults to "Re: <original subject>" if omitted' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    subject?: string;

    @ApiProperty({ description: 'HTML or plain text email body' })
    @IsString()
    @MinLength(1)
    content: string;
}
