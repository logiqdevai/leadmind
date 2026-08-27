import { DomainValidationStatus, InteractionType, PrismaClient } from '@/generated/prisma';
import { validateWebsiteDomain } from '@/shared/utils/website-domain-validation.util';

const BATCH_SIZE = 200;
const CONCURRENCY = 10;

export interface WebsiteBackfillCounters {
    checked: number;
    invalidated: number;
    statusUpdated: number;
    errors: number;
}

export interface WebsiteValidationBackfillResult {
    leads: WebsiteBackfillCounters;
    contacts: WebsiteBackfillCounters;
    dry_run: boolean;
    started_at: string;
    completed_at: string;
}

export interface WebsiteValidationBackfillOptions {
    organisation_uuid?: string;
    dryRun?: boolean;
    log?: (message: string) => void;
}

function emptyCounters(): WebsiteBackfillCounters {
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
): Promise<WebsiteBackfillCounters> {
    const counters = emptyCounters();
    let cursor: number | undefined;

    for (;;) {
        const leads = await prisma.lead.findMany({
            where: {
                website: { not: null },
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
                const result = await validateWebsiteDomain(lead.website);
                if (result.status === DomainValidationStatus.INVALID) {
                    counters.invalidated++;
                    log(
                        `[lead:${lead.uuid}] INVALID (${result.reason}) — clearing website '${lead.website}'${dryRun ? ' [dry-run]' : ''}`,
                    );
                    if (!dryRun) {
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: {
                                website: null,
                                website_validation_status: DomainValidationStatus.UNKNOWN,
                                website_validation_reason: null,
                                website_validated_at: null,
                            },
                        });
                    }
                } else {
                    counters.statusUpdated++;
                    if (!dryRun) {
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: {
                                website_validation_status: result.status,
                                website_validation_reason: result.reason,
                                website_validated_at: new Date(),
                            },
                        });
                    }
                }
            } catch (error) {
                counters.errors++;
                log(`[lead:${lead.uuid}] error validating website: ${error instanceof Error ? error.message : error}`);
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
): Promise<WebsiteBackfillCounters> {
    const counters = emptyCounters();
    let cursor: number | undefined;

    for (;;) {
        const contacts = await prisma.contact.findMany({
            where: {
                website: { not: null },
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
                const result = await validateWebsiteDomain(contact.website);
                if (result.status === DomainValidationStatus.INVALID) {
                    counters.invalidated++;
                    log(
                        `[contact:${contact.uuid}] INVALID (${result.reason}) — clearing website '${contact.website}'${dryRun ? ' [dry-run]' : ''}`,
                    );
                    if (!dryRun) {
                        await prisma.$transaction([
                            prisma.contact.update({
                                where: { id: contact.id },
                                data: {
                                    website: null,
                                    website_validation_status: DomainValidationStatus.UNKNOWN,
                                    website_validation_reason: null,
                                    website_validated_at: null,
                                },
                            }),
                            prisma.interaction.create({
                                data: {
                                    contact_uuid: contact.uuid,
                                    organisation_uuid: contact.organisation_uuid,
                                    type: InteractionType.NOTE,
                                    content: `Website removed during data-quality backfill: '${contact.website}' failed validation (${result.reason}).`,
                                    metadata: {
                                        script: 'website-validation-backfill',
                                        removed_website: contact.website,
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
                                website_validation_status: result.status,
                                website_validation_reason: result.reason,
                                website_validated_at: new Date(),
                            },
                        });
                    }
                }
            } catch (error) {
                counters.errors++;
                log(`[contact:${contact.uuid}] error validating website: ${error instanceof Error ? error.message : error}`);
            }
        });

        log(`Contacts checked so far: ${counters.checked}`);
    }

    return counters;
}

/**
 * Validates every Lead/Contact website (syntax, DNS existence). Invalid
 * values are cleared (never overwritten with a bad value); valid/
 * unverifiable ones get their validation status fields refreshed. Clearing a
 * Contact's website also writes an audit-trail Interaction recording what was
 * removed and why, so the action is always reversible.
 */
export async function runWebsiteValidationBackfill(
    prisma: PrismaClient,
    options: WebsiteValidationBackfillOptions = {},
): Promise<WebsiteValidationBackfillResult> {
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
