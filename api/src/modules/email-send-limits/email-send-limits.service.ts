import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
    EmailSendLimit,
    ExternalIntegrationProvider,
    GoalPeriod,
    MsgStatus,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
    getPeriodWindow,
    SENT_MESSAGE_STATUSES,
} from '@/modules/messaging-goals/utils/messaging-goals.utils';
import { UpsertEmailSendLimitDto } from './dto/upsert-email-send-limit.dto';
import {
    EMAIL_SEND_LIMIT_PERIODS,
    EMAIL_SEND_LIMIT_PERIOD_LABELS,
    EMAIL_SEND_LIMIT_PROVIDERS,
    EMAIL_SEND_LIMIT_PROVIDER_LABELS,
} from './constants/email-send-limits.constants';
import { EmailSendLimitStatus } from './interfaces/email-send-limit.interface';

@Injectable()
export class EmailSendLimitsService {
    constructor(private readonly prisma: PrismaService) {}

    async list(organisation_uuid: string): Promise<EmailSendLimitStatus[]> {
        const [timezone, limits, integrations] = await Promise.all([
            this.getOrgTimezone(organisation_uuid),
            this.prisma.emailSendLimit.findMany({ where: { organisation_uuid } }),
            this.prisma.integration.findMany({
                where: {
                    organisation_uuid,
                    provider: { in: EMAIL_SEND_LIMIT_PROVIDERS },
                },
                select: { provider: true },
            }),
        ]);

        const configuredProviders = new Set(integrations.map((integration) => integration.provider));
        const providers = EMAIL_SEND_LIMIT_PROVIDERS.filter((provider) =>
            configuredProviders.has(provider),
        );

        const statuses: EmailSendLimitStatus[] = [];
        for (const provider of providers) {
            for (const period of EMAIL_SEND_LIMIT_PERIODS) {
                const limit =
                    limits.find((row) => row.provider === provider && row.period === period) ?? null;
                statuses.push(
                    await this.buildStatus(organisation_uuid, timezone, provider, period, limit),
                );
            }
        }
        return statuses;
    }

    async upsert(
        organisation_uuid: string,
        dto: UpsertEmailSendLimitDto,
    ): Promise<EmailSendLimit> {
        return this.prisma.emailSendLimit.upsert({
            where: {
                organisation_uuid_provider_period: {
                    organisation_uuid,
                    provider: dto.provider,
                    period: dto.period,
                },
            },
            create: {
                organisation_uuid,
                provider: dto.provider,
                period: dto.period,
                max_count: dto.max_count,
                is_active: dto.is_active ?? true,
            },
            update: {
                max_count: dto.max_count,
                is_active: dto.is_active ?? true,
            },
        });
    }

    async remove(organisation_uuid: string, uuid: string): Promise<{ deleted: true }> {
        const limit = await this.prisma.emailSendLimit.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!limit) {
            throw new BadRequestException('Email send limit not found');
        }
        await this.prisma.emailSendLimit.delete({ where: { uuid } });
        return { deleted: true };
    }

    async assertWithinLimit(
        organisation_uuid: string,
        provider: ExternalIntegrationProvider,
    ): Promise<void> {
        if (!EMAIL_SEND_LIMIT_PROVIDERS.includes(provider)) {
            return;
        }

        const [timezone, limits] = await Promise.all([
            this.getOrgTimezone(organisation_uuid),
            this.prisma.emailSendLimit.findMany({
                where: { organisation_uuid, provider, is_active: true },
            }),
        ]);

        for (const limit of limits) {
            const status = await this.buildStatus(
                organisation_uuid,
                timezone,
                provider,
                limit.period,
                limit,
            );
            if (status.reached) {
                const periodLabel = EMAIL_SEND_LIMIT_PERIOD_LABELS[limit.period];
                const providerLabel = EMAIL_SEND_LIMIT_PROVIDER_LABELS[provider];
                throw new ForbiddenException(
                    `${periodLabel} ${providerLabel} send limit reached (${status.used}/${status.limit}). Resets at ${status.resets_at}.`,
                );
            }
        }
    }

    private async buildStatus(
        organisation_uuid: string,
        timezone: string,
        provider: ExternalIntegrationProvider,
        period: GoalPeriod,
        limit: EmailSendLimit | null,
    ): Promise<EmailSendLimitStatus> {
        const window = getPeriodWindow(period, timezone);
        const used = await this.prisma.outreachMessage.count({
            where: {
                organisation_uuid,
                channel: 'EMAIL',
                campaign_uuid: null,
                email_provider: provider,
                status: { in: [...SENT_MESSAGE_STATUSES] as MsgStatus[] },
                sent_at: { gte: window.starts_at, lte: window.ends_at },
            },
        });
        const max = limit?.is_active ? limit.max_count : null;
        return {
            uuid: limit?.uuid ?? null,
            provider,
            period,
            limit: max,
            is_active: limit?.is_active ?? false,
            used,
            remaining: max === null ? null : Math.max(max - used, 0),
            reached: max !== null && used >= max,
            resets_at: window.ends_at.toISOString(),
        };
    }

    private async getOrgTimezone(organisation_uuid: string): Promise<string> {
        const organisation = await this.prisma.organisation.findUnique({
            where: { uuid: organisation_uuid },
            select: { timezone: true },
        });
        return organisation?.timezone || 'UTC';
    }
}
