import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { QueryBooleanTransform } from '@/shared/transforms/query-boolean.transform';

export class BookingSlotsQueryDto {
    @ApiProperty({ description: 'ISO 8601 range start' })
    @IsDateString()
    from: string;

    @ApiProperty({ description: 'ISO 8601 range end (max 62 days after from)' })
    @IsDateString()
    to: string;

    @ApiPropertyOptional({ description: 'IANA timezone the slots are grouped by date in', example: 'Europe/Athens' })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    timezone?: string;

    @ApiPropertyOptional({ description: 'One of the page durations' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(5)
    @Max(720)
    duration?: number;

    @ApiPropertyOptional({ format: 'uuid', description: 'Only this member (internal, or public when member choice is enabled)' })
    @IsOptional()
    @IsUUID()
    member_uuid?: string;

    @ApiPropertyOptional({ format: 'uuid', description: 'Ignore this booking when computing conflicts (rescheduling)' })
    @IsOptional()
    @IsUUID()
    exclude_booking_uuid?: string;

    @ApiPropertyOptional({ description: 'Internal previews only: also list unbookable start times (flagged available: false)' })
    @IsOptional()
    @QueryBooleanTransform
    @IsBoolean()
    include_unavailable?: boolean;
}
