import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

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
}
