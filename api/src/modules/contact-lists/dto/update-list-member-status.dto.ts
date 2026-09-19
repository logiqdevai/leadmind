import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LeadStatus } from '@/generated/prisma';

export class UpdateListMemberStatusDto {
    @ApiProperty({ enum: LeadStatus })
    @IsEnum(LeadStatus)
    status: LeadStatus;
}
