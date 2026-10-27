import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { CreateContactListDto } from './create-contact-list.dto';

export class UpdateContactListDto extends PartialType(
    OmitType(CreateContactListDto, ['parent_list_uuid', 'tag_uuids', 'assigned_user_uuid'] as const),
) {
    @ApiPropertyOptional({
        description: 'Parent list UUID, or null to move to root',
        nullable: true,
    })
    @IsOptional()
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsUUID()
    parent_list_uuid?: string | null;

    @ApiPropertyOptional({ description: 'Team member responsible for this list, or null to unassign', nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsUUID()
    assigned_user_uuid?: string | null;

    @ApiPropertyOptional({
        type: [String],
        description: 'Replaces the full set of organisation tags on this list (empty array clears them)',
    })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    tag_uuids?: string[];
}
