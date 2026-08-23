import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BulkJobStatus, BulkJobType } from '@/generated/prisma';

export class ListBulkJobsDto {
    @ApiPropertyOptional({ enum: BulkJobStatus })
    @IsOptional()
    @IsEnum(BulkJobStatus)
    status?: BulkJobStatus;

    @ApiPropertyOptional({ enum: BulkJobType })
    @IsOptional()
    @IsEnum(BulkJobType)
    type?: BulkJobType;

    @ApiPropertyOptional({
        default: false,
        description: 'When true and status is omitted, only PENDING/QUEUED/RUNNING jobs are returned',
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return false;
        if (value === true || value === 'true' || value === '1') return true;
        if (value === false || value === 'false' || value === '0') return false;
        return Boolean(value);
    })
    @IsBoolean()
    active_only?: boolean = false;

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
}
