import { Injectable } from '@nestjs/common';
import {
    Channel,
    InteractionType,
    MsgStatus,
    Prisma,
    ThreadOrigin,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ListThreadContactsDto } from './dto/list-thread-contacts.dto';

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
        const threads = await this.prisma.messageThread.findMany({
            where: { organisation_uuid, contact_uuid },
            orderBy: { last_message_at: 'desc' },
        });
        const activityByThread = await this.getThreadActivity(threads.map((thread) => thread.uuid));

        // MessageThread only stores the raw sequence_enrollment_uuid (no Prisma relation), so
        // enrollment status/sequence name for the "cancel sequence" quick action needs a join here.
        const enrollmentUuids = threads
            .map((thread) => thread.sequence_enrollment_uuid)
            .filter((uuid): uuid is string => Boolean(uuid));
        const enrollments = enrollmentUuids.length
            ? await this.prisma.sequenceEnrollment.findMany({
                  where: { uuid: { in: enrollmentUuids } },
                  select: {
                      uuid: true,
                      status: true,
                      sequence: { select: { uuid: true, name: true } },
                  },
              })
            : [];
        const enrollmentByUuid = new Map(enrollments.map((enrollment) => [enrollment.uuid, enrollment]));

        return threads.map((thread) => {
            const activity = activityByThread.get(thread.uuid);
            return {
                ...thread,
                needs_reply: activity?.needsReply ?? false,
                last_message: activity?.lastMessage ?? null,
                sequence_enrollment: thread.sequence_enrollment_uuid
                    ? (enrollmentByUuid.get(thread.sequence_enrollment_uuid) ?? null)
                    : null,
            };
        });
    }

    /**
     * Paginated contacts who have at least one thread, most recently active first - the
     * left-pane data source for the inbox view. One row per contact, aggregating across
     * all of that contact's threads (manual/sequence/campaign).
     */
    async listInboxContacts(organisation_uuid: string, filters: ListThreadContactsDto) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 25;
        const skip = (page - 1) * limit;
        const search = filters.search?.trim();

        // MessageThread only stores the raw sequence_enrollment_uuid (no Prisma relation to
        // SequenceEnrollment), so filtering by sequence identity means resolving its enrollments first.
        const enrollmentUuidsForSequence = filters.sequence_uuid
            ? (
                  await this.prisma.sequenceEnrollment.findMany({
                      where: { sequence_uuid: filters.sequence_uuid },
                      select: { uuid: true },
                  })
              ).map((enrollment) => enrollment.uuid)
            : null;

        const where: Prisma.MessageThreadWhereInput = {
            organisation_uuid,
            ...(filters.channel && { channel: filters.channel }),
            ...(filters.source && { origin: filters.source }),
            ...(filters.campaign_uuid && { campaign_uuid: filters.campaign_uuid }),
            ...(enrollmentUuidsForSequence && {
                sequence_enrollment_uuid: { in: enrollmentUuidsForSequence },
            }),
            ...((filters.date_from || filters.date_to) && {
                last_message_at: {
                    ...(filters.date_from && { gte: new Date(filters.date_from) }),
                    ...(filters.date_to && { lte: new Date(filters.date_to) }),
                },
            }),
            // Status/integration/sent-by are message-level fields - match threads that have at
            // least one message satisfying them, mirroring OutreachService.listMessages' filters.
            ...((filters.status ||
                filters.email_provider ||
                filters.email_account?.trim() ||
                filters.sent_by_user_uuid) && {
                messages: {
                    some: {
                        ...(filters.status && { status: filters.status }),
                        ...(filters.email_provider && { email_provider: filters.email_provider }),
                        ...(filters.email_account?.trim() && {
                            email_account: filters.email_account.trim(),
                        }),
                        ...(filters.sent_by_user_uuid && {
                            sent_by_user_uuid: filters.sent_by_user_uuid,
                        }),
                    },
                },
            }),
            ...(search && {
                contact: {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } },
                    ],
                },
            }),
        };

        const grouped = await this.prisma.messageThread.groupBy({
            by: ['contact_uuid'],
            where,
            _max: { last_message_at: true },
            orderBy: { _max: { last_message_at: 'desc' } },
        });

        const total = grouped.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const pageGroups = grouped.slice(skip, skip + limit);
        const contactUuids = pageGroups.map((group) => group.contact_uuid);

        if (contactUuids.length === 0) {
            return { data: [], total, page, limit, totalPages };
        }

        const [contacts, threads] = await Promise.all([
            this.prisma.contact.findMany({
                where: { uuid: { in: contactUuids } },
                select: { uuid: true, name: true, email: true, phone: true },
            }),
            this.prisma.messageThread.findMany({
                where: { ...where, contact_uuid: { in: contactUuids } },
                orderBy: { last_message_at: 'desc' },
            }),
        ]);

        const activityByThread = await this.getThreadActivity(threads.map((thread) => thread.uuid));

        const threadsByContact = new Map<string, typeof threads>();
        for (const thread of threads) {
            const list = threadsByContact.get(thread.contact_uuid) ?? [];
            list.push(thread);
            threadsByContact.set(thread.contact_uuid, list);
        }

        const contactMap = new Map(contacts.map((contact) => [contact.uuid, contact]));

        const data = pageGroups
            .map((group) => {
                const contact = contactMap.get(group.contact_uuid);
                if (!contact) return null;
                const contactThreads = threadsByContact.get(group.contact_uuid) ?? [];
                const latestThread = contactThreads[0];
                return {
                    contact,
                    last_message_at: group._max.last_message_at,
                    last_channel: latestThread?.channel ?? null,
                    thread_count: contactThreads.length,
                    origins: Array.from(new Set(contactThreads.map((thread) => thread.origin))),
                    last_thread_uuid: latestThread?.uuid ?? null,
                    needs_reply: contactThreads.some(
                        (thread) => activityByThread.get(thread.uuid)?.needsReply,
                    ),
                };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);

        return { data, total, page, limit, totalPages };
    }

    /**
     * Per-thread activity summary: the latest outbound message (uuid + status, so callers can
     * offer "resend" without a second round trip) and whether the thread "needs reply" - i.e.
     * its most recent activity is an inbound reply that hasn't been followed by a new outbound
     * message yet.
     */
    private async getThreadActivity(
        thread_uuids: string[],
    ): Promise<Map<string, { needsReply: boolean; lastMessage: { uuid: string; status: MsgStatus } | null }>> {
        const result = new Map<
            string,
            { needsReply: boolean; lastMessage: { uuid: string; status: MsgStatus } | null }
        >();
        if (thread_uuids.length === 0) {
            return result;
        }

        const messages = await this.prisma.outreachMessage.findMany({
            where: { thread_uuid: { in: thread_uuids } },
            select: { uuid: true, thread_uuid: true, status: true, created_at: true },
            orderBy: { created_at: 'asc' },
        });

        const messageUuidToThread = new Map(
            messages.map((message) => [message.uuid, message.thread_uuid as string]),
        );
        const latestMessageByThread = new Map<
            string,
            { uuid: string; status: MsgStatus; at: number }
        >();
        for (const message of messages) {
            if (!message.thread_uuid) continue;
            latestMessageByThread.set(message.thread_uuid, {
                uuid: message.uuid,
                status: message.status,
                at: message.created_at.getTime(),
            });
        }

        const messageUuids = messages.map((message) => message.uuid);
        const replies = messageUuids.length
            ? await this.prisma.interaction.findMany({
                  where: {
                      type: InteractionType.REPLY_RECEIVED,
                      outreach_message_uuid: { in: messageUuids },
                  },
                  select: { outreach_message_uuid: true, created_at: true },
              })
            : [];

        const latestReplyAtByThread = new Map<string, number>();
        for (const reply of replies) {
            const thread_uuid = reply.outreach_message_uuid
                ? messageUuidToThread.get(reply.outreach_message_uuid)
                : undefined;
            if (!thread_uuid) continue;
            const at = reply.created_at.getTime();
            const current = latestReplyAtByThread.get(thread_uuid) ?? 0;
            if (at > current) {
                latestReplyAtByThread.set(thread_uuid, at);
            }
        }

        for (const thread_uuid of thread_uuids) {
            const lastMessage = latestMessageByThread.get(thread_uuid) ?? null;
            const latestReplyAt = latestReplyAtByThread.get(thread_uuid) ?? 0;
            result.set(thread_uuid, {
                needsReply: latestReplyAt > (lastMessage?.at ?? 0),
                lastMessage: lastMessage ? { uuid: lastMessage.uuid, status: lastMessage.status } : null,
            });
        }
        return result;
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
