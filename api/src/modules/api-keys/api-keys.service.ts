import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { generateApiKey } from '@/shared/utils/api-key/api-key.util';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

const API_KEY_SELECT = {
    uuid: true,
    name: true,
    key_prefix: true,
    last4: true,
    organisation_role: true,
    last_used_at: true,
    expires_at: true,
    revoked_at: true,
    created_at: true,
    updated_at: true,
    created_by_user_uuid: true,
};

@Injectable()
export class ApiKeysService {
    constructor(private readonly prisma: PrismaService) {}

    async create(organisation_uuid: string, created_by_user_uuid: string, dto: CreateApiKeyDto) {
        const generated = generateApiKey();

        const apiKey = await this.prisma.apiKey.create({
            data: {
                organisation_uuid,
                created_by_user_uuid,
                name: dto.name,
                organisation_role: dto.organisation_role,
                expires_at: dto.expires_at ? new Date(dto.expires_at) : undefined,
                key_prefix: generated.key_prefix,
                last4: generated.last4,
                key_hash: generated.key_hash,
            },
            select: API_KEY_SELECT,
        });

        return { ...apiKey, token: generated.token };
    }

    async findAll(organisation_uuid: string) {
        return this.prisma.apiKey.findMany({
            where: { organisation_uuid },
            select: API_KEY_SELECT,
            orderBy: { created_at: 'desc' },
        });
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const apiKey = await this.prisma.apiKey.findFirst({
            where: { uuid, organisation_uuid },
            select: API_KEY_SELECT,
        });
        if (!apiKey) throw new NotFoundException('API key not found');
        return apiKey;
    }

    async update(organisation_uuid: string, uuid: string, dto: UpdateApiKeyDto) {
        await this.findOne(organisation_uuid, uuid);

        return this.prisma.apiKey.update({
            where: { uuid },
            data: {
                name: dto.name,
                organisation_role: dto.organisation_role,
                ...(dto.expires_at !== undefined && { expires_at: new Date(dto.expires_at) }),
            },
            select: API_KEY_SELECT,
        });
    }

    async revoke(organisation_uuid: string, uuid: string) {
        await this.findOne(organisation_uuid, uuid);

        return this.prisma.apiKey.update({
            where: { uuid },
            data: { revoked_at: new Date() },
            select: API_KEY_SELECT,
        });
    }

    async remove(organisation_uuid: string, uuid: string) {
        await this.findOne(organisation_uuid, uuid);
        await this.prisma.apiKey.delete({ where: { uuid } });
        return { uuid };
    }
}
