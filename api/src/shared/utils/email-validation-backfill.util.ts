import { EmailValidationStatus, InteractionType, PrismaClient } from '@/generated/prisma';
import { validateEmailAddress } from '@/shared/utils/email-domain-validation.util';

const BATCH_SIZE = 200;
const CONCURRENCY = 10;

export interface EmailBackfillCounters {
    checked: number;
    invalidated: number;
    statusUpdated: number;
    errors: number;
}

export interface EmailValidationBackfillResult {
    leads: EmailBackfillCounters;
    contacts: EmailBackfillCounters;
    dry_run: boolean;
    started_at: string;
    completed_at: string;
}

export interface EmailValidationBackfillOptions {
    organisation_uuid?: string;
    dryRun?: boolean;
    log?: (message: string) => void;
}

function emptyCounters(): EmailBackfillCounters {
    return { checked: 0, invalidated: 0, statusUpdated: 0, errors: 0 };
}

async function mapWithConcurrency<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    let index = 0;
    async function worker(): Promise<void> {
        while (index < items.length) {
            const current = items[index++]!;
            await fn(current);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function backfillLeads(
    prisma: PrismaClient,
    organisation_uuid: string | undefined,
    dryRun: boolean,
    log: (message: string) => void,
): Promise<EmailBackfillCounters> {
    const counters = emptyCounters();
    let cursor: number | undefined;

    for (;;) {
        const leads = await prisma.lead.findMany({
            where: {
                email: { not: null },
                ...(cursor ? { id: { gt: cursor } } : {}),
                ...(organisation_uuid ? { contacts: { some: { organisation_uuid } } } : {}),
            },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
        });
        if (leads.length === 0) break;
        cursor = leads[leads.length - 1]!.id;

        await mapWithConcurrency(leads, CONCURRENCY, async (lead) => {
            counters.checked++;
            try {
                const result = await validateEmailAddress(lead.email);
                if (result.status === EmailValidationStatus.INVALID) {
                    counters.invalidated++;
                    log(
                        `[lead:${lead.uuid}] INVALID (${result.reason}) — clearing email '${lead.email}'${dryRun ? ' [dry-run]' : ''}`,
                    );
                    if (!dryRun) {
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: {
                                email: null,
                                email_validation_status: EmailValidationStatus.UNKNOWN,
                                email_validation_reason: null,
                                email_validated_at: null,
                            },
                        });
                    }
                } else {
                    counters.statusUpdated++;
                    if (!dryRun) {
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: {
                                email_validation_status: result.status,
                                email_validation_reason: result.reason,
                                email_validated_at: new Date(),
                            },
                        });
                    }
                }
            } catch (error) {
                counters.errors++;
                log(`[lead:${lead.uuid}] error validating email: ${error instanceof Error ? error.message : error}`);
            }
        });

        log(`Leads checked so far: ${counters.checked}`);
    }

    return counters;
}

async function backfillContacts(
    prisma: PrismaClient,
    organisation_uuid: string | undefined,
    dryRun: boolean,
    log: (message: string) => void,
): Promise<EmailBackfillCounters> {
    const counters = emptyCounters();
    let cursor: number | undefined;

    for (;;) {
        const contacts = await prisma.contact.findMany({
            where: {
                email: { not: null },
                ...(cursor ? { id: { gt: cursor } } : {}),
                ...(organisation_uuid ? { organisation_uuid } : {}),
            },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
        });
        if (contacts.length === 0) break;
        cursor = contacts[contacts.length - 1]!.id;

        await mapWithConcurrency(contacts, CONCURRENCY, async (contact) => {
            counters.checked++;
            try {
                const result = await validateEmailAddress(contact.email);
                if (result.status === EmailValidationStatus.INVALID) {
                    counters.invalidated++;
                    log(
                        `[contact:${contact.uuid}] INVALID (${result.reason}) — clearing email '${contact.email}'${dryRun ? ' [dry-run]' : ''}`,
                    );
                    if (!dryRun) {
                        await prisma.$transaction([
                            prisma.contact.update({
                                where: { id: contact.id },
                                data: {
                                    email: null,
                                    email_validation_status: EmailValidationStatus.UNKNOWN,
                                    email_validation_reason: null,
                                    email_validated_at: null,
                                },
                            }),
                            prisma.interaction.create({
                                data: {
                                    contact_uuid: contact.uuid,
                                    organisation_uuid: contact.organisation_uuid,
                                    type: InteractionType.NOTE,
                                    content: `Email removed during data-quality backfill: '${contact.email}' failed validation (${result.reason}).`,
                                    metadata: {
                                        script: 'email-validation-backfill',
                                        removed_email: contact.email,
                                        reason: result.reason,
                                    },
                                },
                            }),
                        ]);
                    }
                } else {
                    counters.statusUpdated++;
                    if (!dryRun) {
                        await prisma.contact.update({
                            where: { id: contact.id },
                            data: {
                                email_validation_status: result.status,
                                email_validation_reason: result.reason,
                                email_validated_at: new Date(),
                            },
                        });
                    }
                }
            } catch (error) {
                counters.errors++;
                log(`[contact:${contact.uuid}] error validating email: ${error instanceof Error ? error.message : error}`);
            }
        });

        log(`Contacts checked so far: ${counters.checked}`);
    }

    return counters;
}

/**
 * Validates every Lead/Contact email (syntax, disposable domain, MX record).
 * Invalid addresses are cleared (never overwritten with a bad value); valid/
 * unverifiable ones get their validation status fields refreshed. Clearing a
 * Contact's email also writes an audit-trail Interaction recording what was
 * removed and why, so the action is always reversible.
 */
export async function runEmailValidationBackfill(
    prisma: PrismaClient,
    options: EmailValidationBackfillOptions = {},
): Promise<EmailValidationBackfillResult> {
    const { organisation_uuid, dryRun = false, log = () => {} } = options;
    const started_at = new Date().toISOString();

    const leads = await backfillLeads(prisma, organisation_uuid, dryRun, log);
    const contacts = await backfillContacts(prisma, organisation_uuid, dryRun, log);

    return {
        leads,
        contacts,
        dry_run: dryRun,
        started_at,
        completed_at: new Date().toISOString(),
    };
}
