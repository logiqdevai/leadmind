import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderSendingPolicyStagesDto {
  @ApiProperty({
    type: [String],
    description: 'Full ordered list of stage uuids for this policy',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  stage_uuids!: string[];
}
