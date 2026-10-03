import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ListContactsDto } from '@/modules/contacts/dto/list-contacts.dto';
import {
    CONTACT_LIST_MEMBER_SORT_FIELD_KEYS,
    ContactListMemberSortField,
} from '../constants/contact-list-member-sort-fields.constants';

export class ListContactListMembersDto extends OmitType(ListContactsDto, [
    'page',
    'limit',
    'sort_by',
] as const) {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 10000 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(10000)
    limit?: number = 50;

    @ApiPropertyOptional({
        enum: CONTACT_LIST_MEMBER_SORT_FIELD_KEYS,
        description: 'Column to sort by (default: added_at)',
    })
    @IsOptional()
    @IsIn(CONTACT_LIST_MEMBER_SORT_FIELD_KEYS)
    sort_by?: ContactListMemberSortField;
}
