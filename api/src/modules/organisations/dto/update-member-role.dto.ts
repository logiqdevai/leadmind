import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OrganisationRole } from 'generated/prisma';

export class UpdateMemberRoleDto {
    @ApiProperty({ enum: [OrganisationRole.ADMIN, OrganisationRole.MEMBER] })
    @IsIn([OrganisationRole.ADMIN, OrganisationRole.MEMBER])
    role: OrganisationRole;
}
