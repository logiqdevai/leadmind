import { PrismaPg } from '@prisma/adapter-pg';
import { InteractionType, PrismaClient } from '@/generated/prisma';
import { resolveEmailFieldsForWrite } from '@/shared/utils/email-domain-validation.util';

const DRY_RUN = !process.argv.includes('--yes');

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

    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    let restored = 0;
    let skipped = 0;
    let stillInvalid = 0;

    try {
        const affected = await prisma.interaction.findMany({
            where: {
                type: InteractionType.NOTE,
                metadata: { path: ['script'], equals: 'backfill-invalid-emails' },
            },
            include: { contact: { include: { lead: true } } },
        });

        console.log(`Found ${affected.length} contacts previously cleared by the backfill script.\n`);

        for (const interaction of affected) {
            const metadata = interaction.metadata as { removed_email?: string; reason?: string } | null;
            const removedEmail = metadata?.removed_email;
            const contact = interaction.contact;

            if (!removedEmail || !contact) {
                skipped++;
                continue;
            }

            if (contact.email) {
                console.log(`[contact:${contact.uuid}] already has an email ('${contact.email}') — skipping.`);
                skipped++;
                continue;
            }

            const fields = await resolveEmailFieldsForWrite(removedEmail);
            if (!fields) {
                console.log(`[contact:${contact.uuid}] '${removedEmail}' still fails validation after cleaning — leaving cleared.`);
                stillInvalid++;
                continue;
            }

            console.log(
                `[contact:${contact.uuid}] restoring '${fields.email}' (cleaned from '${removedEmail}', status=${fields.email_validation_status})${DRY_RUN ? ' [dry-run]' : ''}`,
            );
            restored++;

            if (DRY_RUN) continue;

            await prisma.contact.update({
                where: { uuid: contact.uuid },
                data: fields,
            });

            if (contact.lead && !contact.lead.email) {
                await prisma.lead.update({
                    where: { uuid: contact.lead.uuid },
                    data: fields,
                });
            }

            await prisma.interaction.create({
                data: {
                    contact_uuid: contact.uuid,
                    organisation_uuid: contact.organisation_uuid,
                    type: InteractionType.NOTE,
                    content: `Email restored: '${fields.email}' (previously cleared incorrectly — the original value was a comma-joined multi-address string, not a genuinely invalid email; the validator now extracts a single clean address instead of rejecting the whole field).`,
                    metadata: {
                        script: 'recover-comma-joined-emails',
                        restored_email: fields.email,
                        original_value: removedEmail,
                    },
                },
            });
        }

        console.log('\n=== Summary ===');
        console.log({ restored, skipped, stillInvalid, total: affected.length });
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
