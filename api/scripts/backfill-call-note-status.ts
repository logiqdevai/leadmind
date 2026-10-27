import { PrismaPg } from '@prisma/adapter-pg';
import { CallNoteStatus, InteractionType, PrismaClient } from '@/generated/prisma';
import { detectCallNoteStatus } from '@/modules/contacts/utils/call-note-status.utils';

/**
 * One-off backfill: reads the notes of every logged call that has no call_note_status yet and, when the
 * text matches one of the statuses (a Quick note preset line, or clear wording such as "wrong number"),
 * stores that status on the call. Calls whose notes don't clearly match are left untouched.
 */

const DRY_RUN = !process.argv.includes('--yes');
const organisationArg = process.argv.find((arg) => arg.startsWith('--organisation='));
const organisation_uuid = organisationArg?.split('=')[1];
const BATCH_SIZE = 500;

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
    if (organisation_uuid) console.log(`Scoped to organisation ${organisation_uuid}`);

    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    const countsByStatus = new Map<CallNoteStatus, number>();
    let scanned = 0;
    let unmatched = 0;
    let cursor = 0;

    try {
        for (;;) {
            const calls = await prisma.interaction.findMany({
                where: {
                    type: InteractionType.CALL,
                    call_note_status: null,
                    content: { not: null },
                    id: { gt: cursor },
                    ...(organisation_uuid ? { organisation_uuid } : {}),
                },
                select: { id: true, uuid: true, content: true },
                orderBy: { id: 'asc' },
                take: BATCH_SIZE,
            });
            if (calls.length === 0) break;
            cursor = calls[calls.length - 1].id;
            scanned += calls.length;

            const uuidsByStatus = new Map<CallNoteStatus, string[]>();
            for (const call of calls) {
                const status = detectCallNoteStatus(call.content);
                if (!status) {
                    unmatched++;
                    continue;
                }
                uuidsByStatus.set(status, [...(uuidsByStatus.get(status) ?? []), call.uuid]);
            }

            for (const [status, uuids] of uuidsByStatus) {
                countsByStatus.set(status, (countsByStatus.get(status) ?? 0) + uuids.length);
                if (!DRY_RUN) {
                    await prisma.interaction.updateMany({
                        where: { uuid: { in: uuids }, call_note_status: null },
                        data: { call_note_status: status },
                    });
                }
            }
            console.log(`Processed ${scanned} calls so far…`);
        }

        console.log(`\n${DRY_RUN ? 'Would set' : 'Set'} call_note_status on:`);
        for (const [status, count] of [...countsByStatus.entries()].sort((a, b) => b[1] - a[1])) {
            console.log(`  ${status.padEnd(20)} ${count}`);
        }
        const matched = [...countsByStatus.values()].reduce((sum, n) => sum + n, 0);
        console.log(`\nScanned ${scanned} calls with notes: ${matched} matched, ${unmatched} left without a status.`);
        if (DRY_RUN) console.log('Dry run only — re-run with --yes to write these.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
