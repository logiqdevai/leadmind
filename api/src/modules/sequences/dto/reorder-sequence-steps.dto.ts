import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderSequenceStepsDto {
    @ApiProperty({
        type: [String],
        description: 'Full ordered list of step uuids for this sequence',
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('all', { each: true })
    step_uuids!: string[];
}
