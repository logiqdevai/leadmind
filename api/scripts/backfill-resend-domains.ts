import { PrismaPg } from '@prisma/adapter-pg';
import {
    ExternalIntegrationProvider,
    IntegrationKeyType,
    PrismaClient,
} from '@/generated/prisma';
import { decryptIntegrationSecret } from '@/shared/utils/integration-secret.util';

const DRY_RUN = !process.argv.includes('--yes');
const organisationArg = process.argv.find((arg) => arg.startsWith('--organisation='));
const organisation_uuid = organisationArg?.split('=')[1];

async function main(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is not set.');
        process.exit(1);
    }
    const encryptionKey =
        process.env.INTEGRATIONS_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
    if (!encryptionKey) {
        console.error('INTEGRATIONS_ENCRYPTION_KEY (or JWT_SECRET) is not set.');
        process.exit(1);
    }

    console.log(
        DRY_RUN
            ? 'Running in DRY-RUN mode — no changes will be written. Pass --yes to apply changes.'
            : 'Running with --yes — changes WILL be written to the database.',
    );
    if (organisation_uuid) {
        console.log(`Scoped to organisation ${organisation_uuid}`);
    }

    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    let accountsScanned = 0;
    let domainsCreated = 0;
    let domainsSkipped = 0;
    let anomalies = 0;

    try {
        const integrations = await prisma.integration.findMany({
            where: {
                provider: ExternalIntegrationProvider.RESEND,
                ...(organisation_uuid ? { organisation_uuid } : {}),
            },
            include: { keys: true, accounts: true },
        });

        for (const integration of integrations) {
            const accountsByLabel = new Map(
                integration.accounts.map((row) => [row.account, row]),
            );
            const fromEmailKeys = integration.keys.filter(
                (key) => key.key_type === IntegrationKeyType.FROM_EMAIL,
            );

            for (const key of fromEmailKeys) {
                accountsScanned++;
                const account = accountsByLabel.get(key.account);
                if (!account) {
                    anomalies++;
                    console.error(
                        `[anomaly] No IntegrationAccount for integration=${integration.uuid} account="${key.account}" — skipping`,
                    );
                    continue;
                }

                let fromEmail: string;
                try {
                    fromEmail = decryptIntegrationSecret(
                        key.secret,
                        encryptionKey,
                    ).trim();
                } catch (error) {
                    anomalies++;
                    console.error(
                        `[anomaly] Failed to decrypt FROM_EMAIL for account=${account.uuid} ("${account.account}"): ${error instanceof Error ? error.message : error}`,
                    );
                    continue;
                }

                const existing = await prisma.integrationAccountDomain.findFirst({
                    where: {
                        integration_account_uuid: account.uuid,
                        from_email: fromEmail.toLowerCase(),
                    },
                });
                if (existing) {
                    domainsSkipped++;
                    console.log(
                        `[skip] Domain "${fromEmail}" already exists for account=${account.uuid} ("${account.account}")`,
                    );
                    continue;
                }

                console.log(
                    `[${DRY_RUN ? 'would create' : 'create'}] domain "${fromEmail}" for account=${account.uuid} ("${account.account}", org=${integration.organisation_uuid})`,
                );
                if (!DRY_RUN) {
                    await prisma.integrationAccountDomain.create({
                        data: {
                            integration_account_uuid: account.uuid,
                            from_email: fromEmail.toLowerCase(),
                            is_default: true,
                        },
                    });
                }
                domainsCreated++;
            }
        }

        console.log('\n=== Summary ===');
        console.log('RESEND accounts scanned:', accountsScanned);
        console.log('Domains created:        ', domainsCreated);
        console.log('Domains skipped (exist):', domainsSkipped);
        console.log('Anomalies:               ', anomalies);
        if (DRY_RUN) {
            console.log('\nThis was a dry run — nothing was written. Re-run with --yes to apply.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
