import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class FilterListContactsByScoreDto {
    @ApiPropertyOptional({
        description: 'Remove or move contacts whose current score is strictly below this value',
        minimum: 1,
        maximum: 10,
        default: 6,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10)
    min_score?: number = 6;
}

export class MoveListContactsBelowScoreDto extends FilterListContactsByScoreDto {
    @ApiProperty({ description: 'Destination list UUID' })
    @IsUUID()
    target_list_uuid: string;
}
