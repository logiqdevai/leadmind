import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
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
}
