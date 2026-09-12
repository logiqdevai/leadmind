import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class BulkSendExistingMessagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  uuids: string[];

  @ApiProperty({
    required: false,
    description:
      'Also reactivate the sequence enrollment for any selected FAILED message whose enrollment was cancelled, so later steps resume.',
  })
  @IsOptional()
  @IsBoolean()
  restart_sequence?: boolean;
}
