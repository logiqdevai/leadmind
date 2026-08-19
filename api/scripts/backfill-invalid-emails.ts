import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma';
import { runEmailValidationBackfill } from '@/shared/utils/email-validation-backfill.util';

const DRY_RUN = !process.argv.includes('--yes');
const organisationArg = process.argv.find((arg) => arg.startsWith('--organisation='));
const organisation_uuid = organisationArg?.split('=')[1];

async function main(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is not set.');
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

    try {
        const result = await runEmailValidationBackfill(prisma, {
            organisation_uuid,
            dryRun: DRY_RUN,
            log: (message) => console.log(message),
        });

        console.log('\n=== Summary ===');
        console.log('Leads:   ', result.leads);
        console.log('Contacts:', result.contacts);
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
