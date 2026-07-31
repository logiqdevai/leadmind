import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { CreateJwtService } from '@/shared/utils/jwt/jwt.service';
import { MailService } from '@/modules/internal/mail/mail.service';
import { EmailConfig } from '@/shared/config/email/index';
import {
    OrganisationInviteRole,
    OrganisationInviteStatus,
    OrganisationRole,
} from 'generated/prisma';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { slugifyOrganisationName } from './utils/organisation-slug.utils';
import { randomBytes } from 'crypto';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class OrganisationsService {
    private readonly logger = new Logger(OrganisationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: CreateJwtService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
    ) {}

    async createForUser(userUuid: string, name: string) {
        const suffix = randomBytes(4).toString('hex');
        const slug = slugifyOrganisationName(name, suffix);

        return this.prisma.$transaction(async (tx) => {
            const organisation = await tx.organisation.create({
                data: { name, slug },
            });

            await tx.organisationMember.create({
                data: {
                    organisation_uuid: organisation.uuid,
                    user_uuid: userUuid,
                    role: OrganisationRole.OWNER,
                },
            });

            return organisation;
        });
    }

    async listForUser(userUuid: string) {
        const memberships = await this.prisma.organisationMember.findMany({
            where: { user_uuid: userUuid },
            include: { organisation: true },
            orderBy: { created_at: 'asc' },
        });

        return memberships.map((m) => ({
            uuid: m.organisation.uuid,
            name: m.organisation.name,
            slug: m.organisation.slug,
            timezone: m.organisation.timezone,
            reply_to_email: m.organisation.reply_to_email,
            role: m.role,
            created_at: m.organisation.created_at,
            updated_at: m.organisation.updated_at,
        }));
    }

    async getCurrent(organisationUuid: string, userUuid: string) {
        const membership = await this.requireMembership(organisationUuid, userUuid);
        const organisation = await this.prisma.organisation.findUnique({
            where: { uuid: organisationUuid },
        });

        if (!organisation) {
            throw new NotFoundException('Organisation not found');
        }

        return {
            ...organisation,
            role: membership.role,
        };
    }

    async create(userUuid: string, dto: CreateOrganisationDto) {
        const organisation = await this.createForUser(userUuid, dto.name);
        return this.buildAuthResponse(userUuid, organisation.uuid);
    }

    async update(organisationUuid: string, userUuid: string, dto: UpdateOrganisationDto) {
        await this.requireMembership(organisationUuid, userUuid, [
            OrganisationRole.OWNER,
            OrganisationRole.ADMIN,
        ]);

        const data: {
            name?: string;
            slug?: string;
            timezone?: string;
            reply_to_email?: string | null;
        } = {};
        if (dto.name) {
            data.name = dto.name;
            data.slug = slugifyOrganisationName(dto.name, randomBytes(4).toString('hex'));
        }
        if (dto.timezone) {
            data.timezone = dto.timezone;
        }
        if (dto.reply_to_email !== undefined) {
            data.reply_to_email = dto.reply_to_email?.trim() || null;
        }

        return this.prisma.organisation.update({
            where: { uuid: organisationUuid },
            data,
        });
    }

    async remove(organisationUuid: string, userUuid: string) {
        await this.requireMembership(organisationUuid, userUuid, [OrganisationRole.OWNER]);

        const fallbackMembership = await this.prisma.organisationMember.findFirst({
            where: {
                user_uuid: userUuid,
                organisation_uuid: { not: organisationUuid },
            },
            orderBy: { created_at: 'asc' },
        });

        if (!fallbackMembership) {
            throw new BadRequestException('Cannot delete your only organisation');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.openAiBatchJob.deleteMany({
                where: { organisation_uuid: organisationUuid },
            });
            await tx.organisation.delete({ where: { uuid: organisationUuid } });
        });

        return this.buildAuthResponse(userUuid, fallbackMembership.organisation_uuid);
    }

    async switchOrganisation(organisationUuid: string, userUuid: string) {
        await this.requireMembership(organisationUuid, userUuid);
        return this.buildAuthResponse(userUuid, organisationUuid);
    }

    async listMembers(organisationUuid: string, userUuid: string) {
        await this.requireMembership(organisationUuid, userUuid);

        const members = await this.prisma.organisationMember.findMany({
            where: { organisation_uuid: organisationUuid },
            include: {
                user: {
                    select: { uuid: true, email: true, full_name: true, created_at: true },
                },
            },
            orderBy: { created_at: 'asc' },
        });

        return members.map((m) => ({
            uuid: m.uuid,
            role: m.role,
            user_uuid: m.user_uuid,
            email: m.user.email,
            full_name: m.user.full_name,
            created_at: m.created_at,
        }));
    }

    async updateMemberRole(
        organisationUuid: string,
        actorUuid: string,
        targetUserUuid: string,
        dto: UpdateMemberRoleDto,
    ) {
        await this.requireMembership(organisationUuid, actorUuid, [
            OrganisationRole.OWNER,
            OrganisationRole.ADMIN,
        ]);

        if (actorUuid === targetUserUuid) {
            throw new BadRequestException('Cannot change your own role');
        }

        if (dto.role === OrganisationRole.OWNER) {
            throw new BadRequestException('Cannot assign OWNER via role update');
        }

        const target = await this.requireMembership(organisationUuid, targetUserUuid);

        if (target.role === OrganisationRole.OWNER) {
            throw new ForbiddenException('Cannot change owner role');
        }

        return this.prisma.organisationMember.update({
            where: {
                organisation_uuid_user_uuid: {
                    organisation_uuid: organisationUuid,
                    user_uuid: targetUserUuid,
                },
            },
            data: { role: dto.role },
        });
    }

    async removeMember(organisationUuid: string, actorUuid: string, targetUserUuid: string) {
        await this.requireMembership(organisationUuid, actorUuid, [
            OrganisationRole.OWNER,
            OrganisationRole.ADMIN,
        ]);

        const target = await this.requireMembership(organisationUuid, targetUserUuid);

        if (target.role === OrganisationRole.OWNER) {
            throw new ForbiddenException('Cannot remove the organisation owner');
        }

        if (actorUuid === targetUserUuid) {
            throw new BadRequestException('Cannot remove yourself');
        }

        await this.prisma.organisationMember.delete({
            where: {
                organisation_uuid_user_uuid: {
                    organisation_uuid: organisationUuid,
                    user_uuid: targetUserUuid,
                },
            },
        });

        return { success: true };
    }

    async createInvitation(
        organisationUuid: string,
        actorUuid: string,
        dto: CreateInvitationDto,
    ) {
        await this.requireMembership(organisationUuid, actorUuid, [
            OrganisationRole.OWNER,
            OrganisationRole.ADMIN,
        ]);

        const email = dto.email.toLowerCase().trim();

        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const existingMember = await this.prisma.organisationMember.findUnique({
                where: {
                    organisation_uuid_user_uuid: {
                        organisation_uuid: organisationUuid,
                        user_uuid: existingUser.uuid,
                    },
                },
            });
            if (existingMember) {
                throw new ConflictException('User is already a member of this organisation');
            }
        }

        const pending = await this.prisma.organisationInvitation.findFirst({
            where: {
                organisation_uuid: organisationUuid,
                email,
                status: OrganisationInviteStatus.PENDING,
            },
        });

        if (pending) {
            throw new ConflictException('A pending invitation already exists for this email');
        }

        const organisation = await this.prisma.organisation.findUnique({
            where: { uuid: organisationUuid },
        });

        if (!organisation) {
            throw new NotFoundException('Organisation not found');
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

        const invitation = await this.prisma.organisationInvitation.create({
            data: {
                organisation_uuid: organisationUuid,
                email,
                role: dto.role,
                invited_by_user_uuid: actorUuid,
                expires_at: expiresAt,
                token: randomBytes(32).toString('hex'),
            },
        });

        try {
            await this.sendInvitationEmail(organisation.name, invitation.email, invitation.token);
        } catch (error) {
            this.logger.error(
                `Failed to send invite email to=${email} invitation=${invitation.uuid}`,
                error instanceof Error ? error.stack : String(error),
            );
            await this.prisma.organisationInvitation.delete({
                where: { uuid: invitation.uuid },
            });
            throw new InternalServerErrorException(
                'Failed to send invitation email. Please try again.',
            );
        }

        return invitation;
    }

    async listInvitations(organisationUuid: string, actorUuid: string) {
        await this.requireMembership(organisationUuid, actorUuid, [
            OrganisationRole.OWNER,
            OrganisationRole.ADMIN,
        ]);

        return this.prisma.organisationInvitation.findMany({
            where: {
                organisation_uuid: organisationUuid,
                status: OrganisationInviteStatus.PENDING,
            },
            orderBy: { created_at: 'desc' },
        });
    }

    async resendInvitation(
        organisationUuid: string,
        actorUuid: string,
        invitationUuid: string,
    ) {
        await this.requireMembership(organisationUuid, actorUuid, [
            OrganisationRole.OWNER,
            OrganisationRole.ADMIN,
        ]);

        const invitation = await this.prisma.organisationInvitation.findFirst({
            where: {
                uuid: invitationUuid,
                organisation_uuid: organisationUuid,
                status: OrganisationInviteStatus.PENDING,
            },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        const organisation = await this.prisma.organisation.findUnique({
            where: { uuid: organisationUuid },
        });

        if (!organisation) {
            throw new NotFoundException('Organisation not found');
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
        const token = randomBytes(32).toString('hex');

        const updated = await this.prisma.organisationInvitation.update({
            where: { uuid: invitationUuid },
            data: { token, expires_at: expiresAt },
        });

        try {
            await this.sendInvitationEmail(organisation.name, updated.email, updated.token);
        } catch (error) {
            this.logger.error(
                `Failed to resend invite email to=${updated.email} invitation=${updated.uuid}`,
                error instanceof Error ? error.stack : String(error),
            );
            throw new InternalServerErrorException(
                'Failed to resend invitation email. Please try again.',
            );
        }

        return updated;
    }

    async revokeInvitation(organisationUuid: string, actorUuid: string, invitationUuid: string) {
        await this.requireMembership(organisationUuid, actorUuid, [
            OrganisationRole.OWNER,
            OrganisationRole.ADMIN,
        ]);

        const invitation = await this.prisma.organisationInvitation.findFirst({
            where: { uuid: invitationUuid, organisation_uuid: organisationUuid },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        return this.prisma.organisationInvitation.update({
            where: { uuid: invitationUuid },
            data: { status: OrganisationInviteStatus.REVOKED },
        });
    }

    private async sendInvitationEmail(
        organisationName: string,
        email: string,
        token: string,
    ) {
        const appUrl = (
            this.configService.get<string>('APP_URL') || 'http://localhost:5173'
        ).replace(/^["']|["']$/g, '');
        const inviteUrl = `${appUrl}/auth/invite/${token}`;

        await this.mailService.create({
            to: email,
            from: `Leadmind <${EmailConfig.email_addresses.confirmation}>`,
            subject: `Join ${organisationName} on Leadmind`,
            text: `You have been invited to join ${organisationName}. Open this link to accept: ${inviteUrl}`,
            html: `<p>You have been invited to join <strong>${organisationName}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in ${INVITE_EXPIRY_DAYS} days.</p>`,
        });
    }

    async previewInvitation(token: string) {
        const invitation = await this.findValidInvitation(token);
        const organisation = await this.prisma.organisation.findUnique({
            where: { uuid: invitation.organisation_uuid },
        });

        return {
            email: invitation.email,
            role: invitation.role,
            organisation_name: organisation?.name,
            organisation_uuid: invitation.organisation_uuid,
            expires_at: invitation.expires_at,
        };
    }

    async acceptInvitation(token: string, userUuid: string) {
        const invitation = await this.findValidInvitation(token);

        const user = await this.prisma.user.findUnique({ where: { uuid: userUuid } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new ForbiddenException('Invitation email does not match your account');
        }

        const existing = await this.prisma.organisationMember.findUnique({
            where: {
                organisation_uuid_user_uuid: {
                    organisation_uuid: invitation.organisation_uuid,
                    user_uuid: userUuid,
                },
            },
        });

        if (existing) {
            await this.prisma.organisationInvitation.update({
                where: { uuid: invitation.uuid },
                data: {
                    status: OrganisationInviteStatus.ACCEPTED,
                    accepted_at: new Date(),
                },
            });
            return this.buildAuthResponse(userUuid, invitation.organisation_uuid);
        }

        const role =
            invitation.role === OrganisationInviteRole.ADMIN
                ? OrganisationRole.ADMIN
                : OrganisationRole.MEMBER;

        await this.prisma.$transaction(async (tx) => {
            await tx.organisationMember.create({
                data: {
                    organisation_uuid: invitation.organisation_uuid,
                    user_uuid: userUuid,
                    role,
                },
            });

            await tx.organisationInvitation.update({
                where: { uuid: invitation.uuid },
                data: {
                    status: OrganisationInviteStatus.ACCEPTED,
                    accepted_at: new Date(),
                },
            });
        });

        return this.buildAuthResponse(userUuid, invitation.organisation_uuid);
    }

    async buildAuthResponse(userUuid: string, organisationUuid: string) {
        const user = await this.prisma.user.findUnique({ where: { uuid: userUuid } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const membership = await this.requireMembership(organisationUuid, userUuid);
        const organisation = await this.prisma.organisation.findUnique({
            where: { uuid: organisationUuid },
        });

        const token = await this.jwtService.signToken({
            uuid: user.uuid,
            role: user.role,
            organisation_uuid: organisationUuid,
            organisation_role: membership.role,
        });

        const expires_in = this.jwtService.getExpirationTime(token);

        delete (user as { password?: string }).password;

        return {
            access_token: token,
            expires_in,
            user: {
                ...user,
                organisation_uuid: organisationUuid,
                organisation_role: membership.role,
                organisation_name: organisation?.name ?? null,
            },
        };
    }

    private async requireMembership(
        organisationUuid: string,
        userUuid: string,
        allowedRoles?: OrganisationRole[],
    ) {
        const membership = await this.prisma.organisationMember.findUnique({
            where: {
                organisation_uuid_user_uuid: {
                    organisation_uuid: organisationUuid,
                    user_uuid: userUuid,
                },
            },
        });

        if (!membership) {
            throw new ForbiddenException('You are not a member of this organisation');
        }

        if (allowedRoles && allowedRoles.length > 0) {
            if (membership.role === OrganisationRole.OWNER) {
                return membership;
            }
            if (!allowedRoles.includes(membership.role)) {
                throw new ForbiddenException('Insufficient organisation permissions');
            }
        }

        return membership;
    }

    private async findValidInvitation(token: string) {
        const invitation = await this.prisma.organisationInvitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        if (invitation.status !== OrganisationInviteStatus.PENDING) {
            throw new BadRequestException('Invitation is no longer valid');
        }

        if (invitation.expires_at < new Date()) {
            await this.prisma.organisationInvitation.update({
                where: { uuid: invitation.uuid },
                data: { status: OrganisationInviteStatus.EXPIRED },
            });
            throw new BadRequestException('Invitation has expired');
        }

        return invitation;
    }
}
