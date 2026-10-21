import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { QueryBooleanTransform } from '@/shared/transforms/query-boolean.transform';

export const TAG_MATCH_MODES = ['any', 'all'] as const;
export type TagMatchMode = (typeof TAG_MATCH_MODES)[number];

/** Shared list-query params for filtering lists/sequences/campaigns/filters by organisation tags. */
export class TagFilterQueryDto {
    @ApiPropertyOptional({
        type: [String],
        description: 'Only items carrying these organisation tag UUIDs (comma-separated or repeated)',
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') return value.split(',').map((t) => t.trim()).filter(Boolean);
        return value;
    })
    @IsArray()
    @IsUUID('all', { each: true })
    tag_uuids?: string[];

    @ApiPropertyOptional({
        enum: TAG_MATCH_MODES,
        default: 'any',
        description: '"any": item has at least one of tag_uuids. "all": item has every one of them.',
    })
    @IsOptional()
    @IsIn(TAG_MATCH_MODES)
    tag_match?: TagMatchMode;

    @ApiPropertyOptional({ description: 'When true, only items with no tags (ignores tag_uuids)' })
    @IsOptional()
    @QueryBooleanTransform
    @IsBoolean()
    untagged?: boolean;
}
