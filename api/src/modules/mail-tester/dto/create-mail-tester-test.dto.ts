import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EmailProviderTargetDto } from '@/modules/outreach/dto/email-provider.dto';

export class CreateMailTesterTestDto {
  @ApiProperty({ type: EmailProviderTargetDto })
  @ValidateNested()
  @Type(() => EmailProviderTargetDto)
  from!: EmailProviderTargetDto;

  @ApiPropertyOptional({ example: 'Before campaign launch' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
