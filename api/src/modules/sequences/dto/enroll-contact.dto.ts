import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class EnrollContactDto {
    @ApiProperty()
    @IsUUID()
    contact_uuid!: string;

    @ApiPropertyOptional({
        description: 'The contact list this enrollment was launched from, if any',
    })
    @IsOptional()
    @IsUUID()
    list_uuid?: string;
}
