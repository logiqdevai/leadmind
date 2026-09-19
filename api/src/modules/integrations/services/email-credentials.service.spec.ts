/// <reference types="jest" />
import { ExternalIntegrationProvider, IntegrationKeyType } from '@/generated/prisma';
import { EmailCredentialsService } from './email-credentials.service';

describe('EmailCredentialsService.resolveFromEmailForDisplay', () => {
    const organisation_uuid = 'org-uuid';

    function createService(overrides?: {
        integrationAccount?: unknown;
        secret?: string | (() => never);
    }) {
        const prisma = {
            integrationAccount: {
                findFirst: jest.fn().mockResolvedValue(overrides?.integrationAccount ?? null),
            },
        };
        const integrationsService = {
            getDecryptedSecret: jest.fn(async () => {
                if (typeof overrides?.secret === 'function') return overrides.secret();
                return overrides?.secret ?? '';
            }),
        };
        return {
            service: new EmailCredentialsService(integrationsService as any, prisma as any),
            prisma,
            integrationsService,
        };
    }

    const resendAccount = {
        domains: [
            { uuid: 'd-1', from_email: 'hello@first.example', is_default: false },
            { uuid: 'd-2', from_email: ' sales@default.example ', is_default: true },
        ],
    };

    it('returns the domain the message was sent with when the domain is known', async () => {
        const { service } = createService({ integrationAccount: resendAccount });

        await expect(
            service.resolveFromEmailForDisplay(organisation_uuid, ExternalIntegrationProvider.RESEND, 'acct', 'd-1'),
        ).resolves.toBe('hello@first.example');
    });

    it('falls back to the account default domain (trimmed) when no domain was recorded', async () => {
        const { service } = createService({ integrationAccount: resendAccount });

        await expect(
            service.resolveFromEmailForDisplay(organisation_uuid, ExternalIntegrationProvider.RESEND, 'acct', null),
        ).resolves.toBe('sales@default.example');
    });

    it('scopes the account lookup to the organisation', async () => {
        const { service, prisma } = createService({ integrationAccount: resendAccount });

        await service.resolveFromEmailForDisplay(organisation_uuid, ExternalIntegrationProvider.RESEND, 'acct');

        expect(prisma.integrationAccount.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    integration: { organisation_uuid, provider: ExternalIntegrationProvider.RESEND },
                }),
            }),
        );
    });

    it('returns null for the env-key pseudo account and for a removed account', async () => {
        const { service, prisma } = createService({ integrationAccount: null });

        await expect(
            service.resolveFromEmailForDisplay(organisation_uuid, ExternalIntegrationProvider.RESEND, 'env'),
        ).resolves.toBeNull();
        expect(prisma.integrationAccount.findFirst).not.toHaveBeenCalled();

        await expect(
            service.resolveFromEmailForDisplay(organisation_uuid, ExternalIntegrationProvider.RESEND, 'gone'),
        ).resolves.toBeNull();
    });

    it('reads the SMTP from-address secret for that account', async () => {
        const { service, integrationsService } = createService({ secret: ' team@smtp.example ' });

        await expect(
            service.resolveFromEmailForDisplay(organisation_uuid, ExternalIntegrationProvider.SMTP, 'smtp-1'),
        ).resolves.toBe('team@smtp.example');
        expect(integrationsService.getDecryptedSecret).toHaveBeenCalledWith(
            organisation_uuid,
            ExternalIntegrationProvider.SMTP,
            IntegrationKeyType.FROM_EMAIL,
            'smtp-1',
        );
    });

    it('never throws - an undecryptable secret just yields null', async () => {
        const { service } = createService({
            secret: () => {
                throw new Error('secret not found');
            },
        });

        await expect(
            service.resolveFromEmailForDisplay(organisation_uuid, ExternalIntegrationProvider.SMTP, 'smtp-1'),
        ).resolves.toBeNull();
    });

    describe('withResolvedFromEmail', () => {
        const row = (over: Record<string, unknown>) => ({
            uuid: 'm',
            from_email: null as string | null,
            email_provider: ExternalIntegrationProvider.RESEND as ExternalIntegrationProvider | null,
            email_account: 'acct' as string | null,
            email_domain_uuid: null as string | null,
            ...over,
        });

        it('keeps a recorded address and only fills the rows that predate it', async () => {
            const { service } = createService({ integrationAccount: resendAccount });

            const out = await service.withResolvedFromEmail(organisation_uuid, [
                row({ uuid: 'recorded', from_email: 'recorded@sent.example' }),
                row({ uuid: 'old' }),
            ]);

            expect(out.map((r) => [r.uuid, r.from_email])).toEqual([
                ['recorded', 'recorded@sent.example'],
                ['old', 'sales@default.example'],
            ]);
        });

        it('resolves each distinct account/domain once, not once per row', async () => {
            const { service, prisma } = createService({ integrationAccount: resendAccount });

            await service.withResolvedFromEmail(organisation_uuid, [
                row({ uuid: 'a' }),
                row({ uuid: 'b' }),
                row({ uuid: 'c' }),
                row({ uuid: 'd', email_domain_uuid: 'd-1' }),
            ]);

            // one lookup for the default-domain account, one for the explicit d-1 domain
            expect(prisma.integrationAccount.findFirst).toHaveBeenCalledTimes(2);
        });

        it('leaves rows without a sender account (drafts, SMS) and unresolvable accounts untouched', async () => {
            const { service, prisma } = createService({ integrationAccount: null });
            const draft = row({ uuid: 'draft', email_provider: null, email_account: null });
            const gone = row({ uuid: 'gone' });

            const out = await service.withResolvedFromEmail(organisation_uuid, [draft, gone]);

            expect(out).toEqual([draft, gone]);
            expect(prisma.integrationAccount.findFirst).toHaveBeenCalledTimes(1);
        });
    });
});
