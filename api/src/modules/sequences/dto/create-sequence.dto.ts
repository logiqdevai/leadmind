import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateSequenceDto {
    @ApiProperty({ minLength: 1, maxLength: 120 })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiPropertyOptional({
        description:
            'Automatically cancel a contact enrollment (skipping remaining steps) once they reply. Defaults to true.',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    stop_on_reply?: boolean;

    @ApiPropertyOptional({
        type: [Number],
        example: [1, 2, 3, 4, 5],
        description:
            'ISO weekdays (1=Mon ... 7=Sun) steps may be sent on, in the organisation timezone. A step that would land on another day is shifted to the next allowed day at the same time. Defaults to all days; use [1,2,3,4,5] for weekdays only.',
    })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @IsInt({ each: true })
    @Min(1, { each: true })
    @Max(7, { each: true })
    allowed_weekdays?: number[];

    @ApiPropertyOptional({
        type: [String],
        description:
            'Organisation tag UUIDs to group this sequence under. On update this replaces the full set (empty array clears).',
    })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    tag_uuids?: string[];

    @ApiPropertyOptional({
        format: 'uuid',
        nullable: true,
        description: 'Sender profile for messages of standalone enrollments (campaigns use their own). Null clears it.',
    })
    @IsOptional()
    @IsUUID()
    sender_profile_uuid?: string | null;
}
