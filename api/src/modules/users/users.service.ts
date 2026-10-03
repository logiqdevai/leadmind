import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrganisationRole } from 'generated/prisma';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async getMe(userUuid: string) {
        const user = await this.prisma.user.findUnique({
            where: { uuid: userUuid },
            select: {
                uuid: true,
                email: true,
                phone: true,
                full_name: true,
                role: true,
                created_at: true,
                updated_at: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async updateMe(userUuid: string, dto: UpdateUserDto) {
        const user = await this.prisma.user.findUnique({ where: { uuid: userUuid } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (dto.email && dto.email !== user.email) {
            const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (existing) {
                throw new ConflictException('Email is already in use');
            }
        }

        const phone =
            dto.phone === undefined
                ? undefined
                : dto.phone === null || dto.phone.trim() === ''
                  ? null
                  : dto.phone.trim();

        if (phone && phone !== user.phone) {
            const existing = await this.prisma.user.findUnique({ where: { phone } });
            if (existing) {
                throw new ConflictException('Phone number is already in use');
            }
        }

        const updated = await this.prisma.user.update({
            where: { uuid: userUuid },
            data: {
                ...(dto.full_name !== undefined && { full_name: dto.full_name.trim() || null }),
                ...(dto.email !== undefined && { email: dto.email }),
                ...(phone !== undefined && { phone }),
            },
            select: {
                uuid: true,
                email: true,
                phone: true,
                full_name: true,
                role: true,
                created_at: true,
                updated_at: true,
            },
        });

        return updated;
    }

    async changePassword(userUuid: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { uuid: userUuid } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.password) {
            throw new BadRequestException('Password cannot be changed for this account');
        }

        const matches = await bcrypt.compare(dto.current_password, user.password);
        if (!matches) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        const hashedPassword = await bcrypt.hash(dto.new_password, 10);
        await this.prisma.user.update({
            where: { uuid: userUuid },
            data: { password: hashedPassword },
        });

        return { success: true };
    }

    async deleteAccount(userUuid: string) {
        const user = await this.prisma.user.findUnique({ where: { uuid: userUuid } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const memberships = await this.prisma.organisationMember.findMany({
            where: { user_uuid: userUuid },
            include: {
                organisation: {
                    include: { _count: { select: { members: true } } },
                },
            },
        });

        const organisationsToDelete: string[] = [];

        for (const membership of memberships) {
            if (membership.role !== OrganisationRole.OWNER) continue;

            const otherMembers = membership.organisation._count.members - 1;
            if (otherMembers > 0) {
                throw new BadRequestException(
                    `Transfer ownership or remove the other members of "${membership.organisation.name}" before deleting your account.`,
                );
            }

            organisationsToDelete.push(membership.organisation_uuid);
        }

        await this.prisma.$transaction(async (tx) => {
            for (const organisationUuid of organisationsToDelete) {
                await tx.openAiBatchJob.deleteMany({
                    where: { organisation_uuid: organisationUuid },
                });
                await tx.organisation.delete({ where: { uuid: organisationUuid } });
            }

            await tx.user.delete({ where: { uuid: userUuid } });
        });

        return { success: true };
    }
}
