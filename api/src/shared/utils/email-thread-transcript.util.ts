import { Channel } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

interface TranscriptMessage {
    subject: string | null;
    content: string;
    reply_subject: string | null;
    reply_text: string | null;
}

/** Plain-text US/THEM transcript from already-loaded messages, oldest first. */
export function buildEmailTranscript(messages: TranscriptMessage[]): string {
    const parts: string[] = [];
    for (const m of messages) {
        const plainOutbound = m.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (plainOutbound) {
            parts.push(`US: ${plainOutbound.slice(0, 1500)}`);
        }
        if (m.reply_text?.trim()) {
            parts.push(`THEM: ${m.reply_text.trim().slice(0, 1500)}`);
        }
    }
    return parts.join('\n\n');
}

/**
 * Fetches recent email history, oldest first. When `thread_uuid` is given, scopes strictly to
 * that conversation (one sequence enrollment / one campaign / one manual thread) so drafts don't
 * blend context from unrelated concurrent threads with the same contact; otherwise falls back to
 * "recent history for this contact" for genuinely new ad-hoc drafts that don't have a thread yet.
 */
export async function fetchRecentEmailMessages(
    prisma: PrismaService,
    organisation_uuid: string,
    contact_uuid: string,
    limit = 10,
    thread_uuid?: string | null,
): Promise<TranscriptMessage[]> {
    const recentMessages = await prisma.outreachMessage.findMany({
        where: thread_uuid
            ? { thread_uuid, channel: Channel.EMAIL }
            : { contact_uuid, organisation_uuid, channel: Channel.EMAIL },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
            subject: true,
            content: true,
            reply_subject: true,
            reply_text: true,
        },
    });
    return [...recentMessages].reverse();
}

/** Convenience: fetches recent email history and builds a transcript, or '' if there's none. */
export async function fetchRecentEmailTranscript(
    prisma: PrismaService,
    organisation_uuid: string,
    contact_uuid: string,
    limit = 10,
    thread_uuid?: string | null,
): Promise<string> {
    const messages = await fetchRecentEmailMessages(prisma, organisation_uuid, contact_uuid, limit, thread_uuid);
    if (messages.length === 0) return '';
    return buildEmailTranscript(messages);
}
