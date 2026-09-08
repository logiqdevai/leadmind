import { PrismaPg } from '@prisma/adapter-pg';
import { Channel, PrismaClient, ThreadOrigin } from '@/generated/prisma';

/**
 * One-off backfill: assigns every pre-existing OutreachMessage a thread_uuid, grouped the same
 * way new messages get threaded going forward (see ThreadsService.resolveThreadForNewMessage) -
 * one thread per sequence enrollment, one per campaign+contact, and one per remaining
 * contact+channel group (today's implicit "all messages for this contact" grouping, so old
 * manual conversations don't visually fragment on migration).
 */

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

    let threadsCreated = 0;
    let messagesAssigned = 0;

    try {
        const baseWhere = organisation_uuid ? { organisation_uuid } : {};

        // 1. Sequence-originated: one thread per enrollment.
        const sequenceGroups = await prisma.outreachMessage.groupBy({
            by: ['sequence_enrollment_uuid'],
            where: { ...baseWhere, sequence_enrollment_uuid: { not: null }, thread_uuid: null },
            _count: true,
        });
        for (const group of sequenceGroups) {
            const enrollment_uuid = group.sequence_enrollment_uuid;
            if (!enrollment_uuid) continue;
            const first = await prisma.outreachMessage.findFirst({
                where: { sequence_enrollment_uuid: enrollment_uuid, thread_uuid: null },
                orderBy: { created_at: 'asc' },
            });
            if (!first) continue;

            console.log(
                `[${DRY_RUN ? 'would create' : 'create'}] SEQUENCE thread for enrollment=${enrollment_uuid} (${group._count} messages)`,
            );
            if (!DRY_RUN) {
                const thread = await prisma.messageThread.upsert({
                    where: { dedupe_key: `seq:${enrollment_uuid}` },
                    create: {
                        organisation_uuid: first.organisation_uuid,
                        contact_uuid: first.contact_uuid,
                        channel: first.channel,
                        subject: first.subject,
                        origin: ThreadOrigin.SEQUENCE,
                        sequence_enrollment_uuid: enrollment_uuid,
                        campaign_uuid: first.campaign_uuid,
                        dedupe_key: `seq:${enrollment_uuid}`,
                    },
                    update: {},
                });
                const result = await prisma.outreachMessage.updateMany({
                    where: { sequence_enrollment_uuid: enrollment_uuid, thread_uuid: null },
                    data: { thread_uuid: thread.uuid },
                });
                await prisma.messageThread.update({
                    where: { uuid: thread.uuid },
                    data: {
                        message_count: { increment: result.count },
                        last_message_at: new Date(),
                    },
                });
                messagesAssigned += result.count;
            } else {
                messagesAssigned += group._count;
            }
            threadsCreated++;
        }

        // 2. Campaign-originated (remaining): one thread per campaign+contact.
        const campaignGroups = await prisma.outreachMessage.groupBy({
            by: ['campaign_uuid', 'contact_uuid'],
            where: { ...baseWhere, campaign_uuid: { not: null }, thread_uuid: null },
            _count: true,
        });
        for (const group of campaignGroups) {
            const { campaign_uuid, contact_uuid } = group;
            if (!campaign_uuid) continue;
            const first = await prisma.outreachMessage.findFirst({
                where: { campaign_uuid, contact_uuid, thread_uuid: null },
                orderBy: { created_at: 'asc' },
            });
            if (!first) continue;

            const dedupe_key = `camp:${campaign_uuid}:${contact_uuid}`;
            console.log(
                `[${DRY_RUN ? 'would create' : 'create'}] CAMPAIGN thread for campaign=${campaign_uuid} contact=${contact_uuid} (${group._count} messages)`,
            );
            if (!DRY_RUN) {
                const thread = await prisma.messageThread.upsert({
                    where: { dedupe_key },
                    create: {
                        organisation_uuid: first.organisation_uuid,
                        contact_uuid,
                        channel: first.channel,
                        subject: first.subject,
                        origin: ThreadOrigin.CAMPAIGN,
                        campaign_uuid,
                        dedupe_key,
                    },
                    update: {},
                });
                const result = await prisma.outreachMessage.updateMany({
                    where: { campaign_uuid, contact_uuid, thread_uuid: null },
                    data: { thread_uuid: thread.uuid },
                });
                await prisma.messageThread.update({
                    where: { uuid: thread.uuid },
                    data: {
                        message_count: { increment: result.count },
                        last_message_at: new Date(),
                    },
                });
                messagesAssigned += result.count;
            } else {
                messagesAssigned += group._count;
            }
            threadsCreated++;
        }

        // 3. Everything else (manual/ad-hoc): one thread per contact+channel, matching today's
        // implicit "all messages for this contact" grouping so old conversations don't fragment.
        const manualGroups = await prisma.outreachMessage.groupBy({
            by: ['contact_uuid', 'channel'],
            where: { ...baseWhere, thread_uuid: null },
            _count: true,
        });
        for (const group of manualGroups) {
            const { contact_uuid, channel } = group;
            const first = await prisma.outreachMessage.findFirst({
                where: { contact_uuid, channel: channel as Channel, thread_uuid: null },
                orderBy: { created_at: 'asc' },
            });
            if (!first) continue;

            console.log(
                `[${DRY_RUN ? 'would create' : 'create'}] MANUAL thread for contact=${contact_uuid} channel=${channel} (${group._count} messages)`,
            );
            if (!DRY_RUN) {
                const thread = await prisma.messageThread.create({
                    data: {
                        organisation_uuid: first.organisation_uuid,
                        contact_uuid,
                        channel: channel as Channel,
                        subject: first.subject,
                        origin: ThreadOrigin.MANUAL,
                    },
                });
                const result = await prisma.outreachMessage.updateMany({
                    where: { contact_uuid, channel: channel as Channel, thread_uuid: null },
                    data: { thread_uuid: thread.uuid },
                });
                await prisma.messageThread.update({
                    where: { uuid: thread.uuid },
                    data: {
                        message_count: { increment: result.count },
                        last_message_at: new Date(),
                    },
                });
                messagesAssigned += result.count;
            } else {
                messagesAssigned += group._count;
            }
            threadsCreated++;
        }

        console.log('\n=== Summary ===');
        console.log('Threads created:   ', threadsCreated);
        console.log('Messages assigned: ', messagesAssigned);
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
