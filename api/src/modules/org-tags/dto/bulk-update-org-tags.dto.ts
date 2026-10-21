import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrgTagEntityType } from '@/generated/prisma';

export class BulkUpdateOrgTagsDto {
    @ApiProperty({ enum: OrgTagEntityType, description: 'Which kind of item the entity_uuids refer to' })
    @IsEnum(OrgTagEntityType)
    entity_type: OrgTagEntityType;

    @ApiProperty({ type: [String], description: 'UUIDs of the contact lists / sequences / campaigns / filters' })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(500)
    @IsUUID('all', { each: true })
    entity_uuids: string[];

    @ApiPropertyOptional({ type: [String], description: 'Tag UUIDs to add to every item' })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    add_tag_uuids?: string[];

    @ApiPropertyOptional({ type: [String], description: 'Tag UUIDs to remove from every item' })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    remove_tag_uuids?: string[];
}
