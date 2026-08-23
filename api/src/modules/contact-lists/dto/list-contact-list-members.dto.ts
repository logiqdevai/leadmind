import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ListContactsDto } from '@/modules/contacts/dto/list-contacts.dto';

export class ListContactListMembersDto extends OmitType(ListContactsDto, [
    'page',
    'limit',
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
}
