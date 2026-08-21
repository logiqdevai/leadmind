import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class PreviewSendingPolicyDto {
  @ApiProperty({
    minimum: 1,
    description: 'Total contacts to project the schedule against',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contact_count!: number;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  start_at?: string;
}
