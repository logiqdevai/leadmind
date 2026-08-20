import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class EnrollContactDto {
    @ApiProperty()
    @IsUUID()
    contact_uuid!: string;
}
