import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class BulkDeleteBelowScoreDto {
    @ApiPropertyOptional({
        description: 'Delete contacts whose current score is strictly below this value',
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
