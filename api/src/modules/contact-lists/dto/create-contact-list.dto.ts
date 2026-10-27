import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateContactListDto {
    @ApiProperty({ maxLength: 200 })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ description: 'Parent list UUID for nested sublists' })
    @IsOptional()
    @IsUUID()
    parent_list_uuid?: string;

    @ApiPropertyOptional({ description: 'Team member responsible for this list' })
    @IsOptional()
    @IsUUID()
    assigned_user_uuid?: string;

    @ApiPropertyOptional({ type: [String], description: 'Organisation tag UUIDs to group this list under' })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    tag_uuids?: string[];
}
