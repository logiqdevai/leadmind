import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SequenceStatus } from '@/generated/prisma';

export class ListSequencesDto {
    @ApiPropertyOptional({ enum: SequenceStatus })
    @IsOptional()
    @IsEnum(SequenceStatus)
    status?: SequenceStatus;
}
