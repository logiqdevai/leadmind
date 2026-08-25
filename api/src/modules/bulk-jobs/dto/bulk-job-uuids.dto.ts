import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BulkJobUuidsDto {
    @ApiProperty({ type: [String], description: 'Bulk job UUIDs' })
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('4', { each: true })
    uuids!: string[];
}
