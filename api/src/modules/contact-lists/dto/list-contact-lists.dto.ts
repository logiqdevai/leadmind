import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { QueryBooleanTransform } from '@/shared/transforms/query-boolean.transform';

export class ListContactListsDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Filter to direct children of this list' })
    @IsOptional()
    @IsUUID()
    parent_list_uuid?: string;

    @ApiPropertyOptional({ description: 'When true, only root lists (no parent)' })
    @IsOptional()
    @QueryBooleanTransform
    @IsBoolean()
    root_only?: boolean;
}
