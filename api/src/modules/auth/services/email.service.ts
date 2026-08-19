import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { RegisterEmailDto } from '../dto/register-email.dto';
import { LoginEmailDto } from '../dto/login-email.dto';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateJwtService } from '@/shared/utils/jwt/jwt.service';
import { AuthRoles } from '../interfaces/auth.interface';
import { WaitlistDto } from '../dto/waitlist.dto';
import { SendgridMailService } from '@/integrations/notifications/sendgrid/services/mail.service';
import { EmailConfig } from '@/shared/constants/email';
import { OrganisationsService } from '@/modules/organisations/organisations.service';

@Injectable()
export class EmailAuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: CreateJwtService,
        private readonly mailService: SendgridMailService,
        private readonly organisationsService: OrganisationsService,
    ) { }

    async registerWithEmail(dto: RegisterEmailDto) {
        try {
            const existingUser = await this.prisma.user.findUnique({
                where: {
                    email: dto.email,
                },
            });

            if (existingUser) {
                throw new ConflictException('User with this email already exists');
            }

            const hashedPassword = await bcrypt.hash(dto.password, 10);

            const user = await this.prisma.user.create({
                data: {
                    email: dto.email,
                    full_name: dto.full_name.trim(),
                    password: hashedPassword,
                    role: AuthRoles.USER,
                },
            });

            const organisation = await this.organisationsService.createForUser(
                user.uuid,
                'logiqdev',
            );

            return this.organisationsService.buildAuthResponse(user.uuid, organisation.uuid);
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Registration failed';
            throw new BadRequestException(message);
        }
    }

    async loginWithEmail(dto: LoginEmailDto) {
        try {
            const user = await this.prisma.user.findUnique({
                where: {
                    email: dto.email,
                },
            });

            if (!user) {
                throw new UnauthorizedException('Invalid credentials');
            }

            const password_match = await bcrypt.compare(dto.password, user.password);

            if (!password_match) {
                throw new UnauthorizedException('Invalid credentials');
            }

            let membership = await this.prisma.organisationMember.findFirst({
                where: { user_uuid: user.uuid },
                orderBy: { updated_at: 'desc' },
            });

            if (!membership) {
                const organisation = await this.organisationsService.createForUser(
                    user.uuid,
                    'logiqdev',
                );
                membership = await this.prisma.organisationMember.findFirst({
                    where: {
                        user_uuid: user.uuid,
                        organisation_uuid: organisation.uuid,
                    },
                });
            }

            return this.organisationsService.buildAuthResponse(
                user.uuid,
                membership.organisation_uuid,
            );
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            const message = error instanceof Error ? error.message : 'Login failed';
            throw new BadRequestException(message);
        }
    }

    async waitlist(dto: WaitlistDto) {
        try {
            const existingUser = await this.prisma.user.findUnique({
                where: {
                    email: dto.email,
                },
            });

            if (existingUser) {
                return { message: 'You are already in the waitlist', code: 'WAITLIST_ALREADY_EXISTS' };
            }

            await this.prisma.user.create({
                data: {
                    email: dto.email,
                    password: '',
                    role: AuthRoles.USER,
                },
            });

            await this.mailService.sendEmail({
                to: dto.email,
                from: EmailConfig.email_addresses.alert,
                subject: EmailConfig.templates.waitlist.subject,
                template_id: EmailConfig.templates.waitlist.template_id,
            });

            return { message: 'You have been successfully added to the waitlist', code: 'WAITLIST_SUCCESS' };
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new BadRequestException('Failed to waitlist user', detail);
        }
    }
}
