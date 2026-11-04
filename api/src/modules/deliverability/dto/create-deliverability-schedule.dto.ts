import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DeliverabilityActionMode,
  DeliverabilityFrequency,
} from '@/generated/prisma';
import { EmailProviderTargetDto } from '@/modules/outreach/dto/email-provider.dto';
import { DeliverabilityCheckType } from '../constants/deliverability.constants';
import {
  MAX_DAY_OF_MONTH,
  MAX_INTERVAL_DAYS,
} from '../utils/schedule-cadence.util';

const DOMAIN_REGEX =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export class CreateDeliverabilityScheduleDto {
  @ApiPropertyOptional({ example: 'Main sending domain' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({
    type: EmailProviderTargetDto,
    description:
      'Integration (SMTP / Resend) account, and optionally one of its domains, to test. ' +
      'Required for MAIL_TESTER checks and for THROTTLE / PAUSE actions. Omit when using custom_domain.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailProviderTargetDto)
  from?: EmailProviderTargetDto;

  @ApiPropertyOptional({
    example: 'example.com',
    description: 'Any domain to check. DNS checks only; cannot throttle or pause sending.',
  })
  @IsOptional()
  @IsString()
  @Matches(DOMAIN_REGEX, { message: 'custom_domain must be a valid domain name' })
  custom_domain?: string;

  @ApiPropertyOptional({ example: 'default', description: 'Adds the DKIM lookup to DNS checks.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dkim_selector?: string;

  @ApiProperty({ enum: DeliverabilityFrequency })
  @IsEnum(DeliverabilityFrequency)
  frequency: DeliverabilityFrequency;

  @ApiProperty({ example: '12:00', description: 'HH:mm in `timezone`.' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time_of_day must be HH:mm' })
  time_of_day: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 7, description: 'ISO weekday (1 = Monday). WEEKLY only.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_DAY_OF_MONTH, description: 'MONTHLY only.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_DAY_OF_MONTH)
  day_of_month?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_INTERVAL_DAYS, description: 'EVERY_N_DAYS only.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INTERVAL_DAYS)
  interval_days?: number;

  @ApiProperty({ example: 'Europe/Athens' })
  @IsString()
  @MaxLength(64)
  timezone: string;

  @ApiPropertyOptional({
    enum: DeliverabilityCheckType,
    isArray: true,
    description: 'Defaults to DNS + MAIL_TESTER.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(Object.values(DeliverabilityCheckType), { each: true })
  checks?: DeliverabilityCheckType[];

  @ApiPropertyOptional({ enum: DeliverabilityActionMode, default: DeliverabilityActionMode.RECOMMEND })
  @IsOptional()
  @IsEnum(DeliverabilityActionMode)
  action_mode?: DeliverabilityActionMode;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 70, description: 'Scores at or above this are healthy.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  warn_threshold?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 99, default: 40, description: 'Scores below this are critical.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  critical_threshold?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
