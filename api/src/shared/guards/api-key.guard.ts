import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { hashApiKey } from '@/shared/utils/api-key/api-key.util';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = request.headers['x-api-key'];

        if (!token || typeof token !== 'string') {
            throw new UnauthorizedException({
                message: 'API key required',
                code: 'api_key_required',
            });
        }

        const key_hash = hashApiKey(token);
        const apiKey = await this.prisma.apiKey.findUnique({ where: { key_hash } });

        if (!apiKey) {
            throw new UnauthorizedException({
                message: 'Invalid API key',
                code: 'invalid_api_key',
            });
        }

        if (apiKey.revoked_at) {
            throw new UnauthorizedException({
                message: 'API key has been revoked',
                code: 'api_key_revoked',
            });
        }

        if (apiKey.expires_at && apiKey.expires_at < new Date()) {
            throw new UnauthorizedException({
                message: 'API key has expired',
                code: 'api_key_expired',
            });
        }

        request.user = {
            uuid: null,
            role: null,
            organisation_uuid: apiKey.organisation_uuid,
            organisation_role: apiKey.organisation_role,
            api_key_uuid: apiKey.uuid,
            acting_user_uuid: apiKey.created_by_user_uuid,
        };

        this.prisma.apiKey
            .update({ where: { uuid: apiKey.uuid }, data: { last_used_at: new Date() } })
            .catch(() => undefined);

        return true;
    }
}
