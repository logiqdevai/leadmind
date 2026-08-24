import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MXTOOLBOX_COMMANDS } from '@/integrations/mxtoolbox/mxtoolbox.constants';

const COMMAND_KEYS = Object.keys(MXTOOLBOX_COMMANDS);

export class CreateMxToolboxCheckDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  @Matches(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i,
    {
      message: 'domain must be a valid domain name',
    },
  )
  domain: string;

  @ApiPropertyOptional({ example: 'Before campaign launch' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({
    description:
      'DKIM selector, e.g. "default". Required to include the DKIM command.',
    example: 'default',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dkim_selector?: string;

  @ApiPropertyOptional({
    enum: COMMAND_KEYS,
    isArray: true,
    description:
      'Which lookups to run. Defaults to a curated domain-health bundle when omitted.',
  })
  @IsOptional()
  @IsArray()
  @IsIn(COMMAND_KEYS, { each: true })
  commands?: (keyof typeof MXTOOLBOX_COMMANDS)[];
}
