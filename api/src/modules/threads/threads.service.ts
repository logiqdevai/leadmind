import { Injectable } from '@nestjs/common';
import {
    Channel,
    Prisma,
    ThreadOrigin,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

export type ThreadClient = PrismaService | Prisma.TransactionClient;

export interface ResolveThreadInput {
    organisation_uuid: string;
    contact_uuid: string;
    channel: Channel;
    subject?: string | null;
    sequence_enrollment_uuid?: string | null;
    campaign_uuid?: string | null;
    /** Set when this message replies to an existing message - inherits its thread directly. */
    reply_to_thread_uuid?: string | null;
}

/**
 * Groups OutreachMessage rows into persisted conversations ("threads"), one per
 * sequence enrollment, one per campaign+contact, or a fresh thread per standalone
 * manual conversation - mirroring the origin markers OutreachMessage already carries
 * instead of recomputing "all messages for this contact" on every read.
 */
@Injectable()
export class ThreadsService {
    constructor(private readonly prisma: PrismaService) { }

    async resolveThreadForNewMessage(
        input: ResolveThreadInput,
        client: ThreadClient = this.prisma,
    ): Promise<string> {
        if (input.reply_to_thread_uuid) {
            return input.reply_to_thread_uuid;
        }

        if (input.sequence_enrollment_uuid) {
            return this.upsertThread(client, {
                ...input,
                dedupe_key: `seq:${input.sequence_enrollment_uuid}`,
                origin: ThreadOrigin.SEQUENCE,
            });
        }

        if (input.campaign_uuid) {
            return this.upsertThread(client, {
                ...input,
                dedupe_key: `camp:${input.campaign_uuid}:${input.contact_uuid}`,
                origin: ThreadOrigin.CAMPAIGN,
            });
        }

        const thread = await client.messageThread.create({
            data: {
                organisation_uuid: input.organisation_uuid,
                contact_uuid: input.contact_uuid,
                channel: input.channel,
                subject: input.subject ?? null,
                origin: ThreadOrigin.MANUAL,
            },
        });
        return thread.uuid;
    }

    /** Bumps last_message_at/message_count - call once per message actually persisted onto a thread. */
    async recordMessageOnThread(
        thread_uuid: string,
        client: ThreadClient = this.prisma,
    ): Promise<void> {
        await client.messageThread.update({
            where: { uuid: thread_uuid },
            data: { last_message_at: new Date(), message_count: { increment: 1 } },
        });
    }

    private async upsertThread(
        client: ThreadClient,
        params: ResolveThreadInput & { dedupe_key: string; origin: ThreadOrigin },
    ): Promise<string> {
        const thread = await client.messageThread.upsert({
            where: { dedupe_key: params.dedupe_key },
            create: {
                organisation_uuid: params.organisation_uuid,
                contact_uuid: params.contact_uuid,
                channel: params.channel,
                subject: params.subject ?? null,
                origin: params.origin,
                sequence_enrollment_uuid: params.sequence_enrollment_uuid ?? null,
                campaign_uuid: params.campaign_uuid ?? null,
                dedupe_key: params.dedupe_key,
            },
            update: {},
        });
        return thread.uuid;
    }

    async listThreadsForContact(organisation_uuid: string, contact_uuid: string) {
        return this.prisma.messageThread.findMany({
            where: { organisation_uuid, contact_uuid },
            orderBy: { last_message_at: 'desc' },
        });
    }

    /**
     * Merges a thread's outbound OutreachMessage rows with ALL interactions recorded against them
     * (delivered/opened/clicked/bounced/replied) in chronological order - a full conversation +
     * activity view spanning every message in the thread, not just one.
     */
    async getThreadDetail(organisation_uuid: string, thread_uuid: string) {
        const thread = await this.prisma.messageThread.findFirst({
            where: { uuid: thread_uuid, organisation_uuid },
        });
        if (!thread) {
            return null;
        }

        const messages = await this.prisma.outreachMessage.findMany({
            where: { thread_uuid },
            orderBy: { created_at: 'asc' },
        });

        const messageUuids = messages.map((message) => message.uuid);
        const interactions = messageUuids.length
            ? await this.prisma.interaction.findMany({
                where: { outreach_message_uuid: { in: messageUuids } },
                orderBy: { created_at: 'asc' },
            })
            : [];

        const timeline = [
            ...messages.map((message) => ({
                kind: 'outbound' as const,
                at: message.created_at,
                message,
            })),
            ...interactions.map((interaction) => ({
                kind: 'interaction' as const,
                at: interaction.created_at,
                interaction,
            })),
        ].sort((a, b) => a.at.getTime() - b.at.getTime());

        return { thread, timeline };
    }
}
