import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SequenceStatus } from '@/generated/prisma';
import { TagFilterQueryDto } from '@/modules/org-tags/dto/tag-filter-query.dto';

export class ListSequencesDto extends TagFilterQueryDto {
    @ApiPropertyOptional({ enum: SequenceStatus })
    @IsOptional()
    @IsEnum(SequenceStatus)
    status?: SequenceStatus;

    @ApiPropertyOptional({ description: 'Case-insensitive match on name or description' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number = 20;
}
