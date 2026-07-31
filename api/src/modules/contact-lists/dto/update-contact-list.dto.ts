import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { CreateContactListDto } from './create-contact-list.dto';

export class UpdateContactListDto extends PartialType(
    OmitType(CreateContactListDto, ['parent_list_uuid'] as const),
) {
    @ApiPropertyOptional({
        description: 'Parent list UUID, or null to move to root',
        nullable: true,
    })
    @IsOptional()
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsUUID()
    parent_list_uuid?: string | null;
}
