import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SourceType } from '@/generated/prisma';
import { QueryBooleanTransform } from '@/shared/transforms/query-boolean.transform';
import { TagFilterQueryDto } from '@/modules/org-tags/dto/tag-filter-query.dto';

export class ListFiltersDto extends TagFilterQueryDto {
    @ApiPropertyOptional({ description: 'Case-insensitive match on filter name' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: SourceType })
    @IsOptional()
    @IsEnum(SourceType)
    source_type?: SourceType;

    @ApiPropertyOptional({ description: 'Only enabled (true) or disabled (false) filters' })
    @IsOptional()
    @QueryBooleanTransform
    @IsBoolean()
    enabled?: boolean;

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
