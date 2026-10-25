import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class BulkTriggerScoreDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('4', { each: true })
    contact_uuids: string[];

    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('4', { each: true })
    scoring_instruction_uuids: string[];

    @ApiPropertyOptional({
        deprecated: true,
        description: 'Deprecated and ignored: scoring always runs as direct jobs.',
    })
    @IsOptional()
    @IsBoolean()
    use_batch?: boolean;
}
