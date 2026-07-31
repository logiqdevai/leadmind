import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { OrganisationInviteRole } from 'generated/prisma';

export class CreateInvitationDto {
    @ApiProperty({ example: 'colleague@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ enum: OrganisationInviteRole, example: OrganisationInviteRole.MEMBER })
    @IsEnum(OrganisationInviteRole)
    role: OrganisationInviteRole;
}
