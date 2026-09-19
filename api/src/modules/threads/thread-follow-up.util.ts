import { Channel, Prisma, ThreadOrigin, ThreadReplyState } from '@/generated/prisma';
import { FOLLOW_UP_DEFAULT_DELAY_DAYS } from '@/modules/reminders/reminders.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A thread "needs follow-up" when we sent the last email, they haven't answered within
 * FOLLOW_UP_DEFAULT_DELAY_DAYS, and it's a conversation worth chasing:
 *  - a manual 1:1 thread (someone wrote it by hand), or
 *  - any thread where the contact has already replied at least once (a live conversation).
 * Cold campaign/sequence sends that never got a reply are excluded - their own cadence owns that.
 * Unsubscribed contacts are never chased.
 */
export function followUpCutoff(now: Date = new Date()): Date {
    return new Date(now.getTime() - FOLLOW_UP_DEFAULT_DELAY_DAYS * DAY_MS);
}

/** Prisma filter for MessageThread rows that currently need a follow-up. Keep in sync with `isThreadNeedingFollowUp`. */
export function needsFollowUpThreadWhere(cutoff: Date): Prisma.MessageThreadWhereInput {
    return {
        channel: Channel.EMAIL,
        reply_state: ThreadReplyState.AWAITING_THEM,
        last_outbound_at: { lte: cutoff },
        contact: { unsubscribed_at: null },
        OR: [{ origin: ThreadOrigin.MANUAL }, { last_inbound_at: { not: null } }],
    };
}

export interface FollowUpThreadFields {
    channel: Channel;
    origin: ThreadOrigin;
    reply_state: ThreadReplyState;
    last_inbound_at: Date | null;
    last_outbound_at: Date | null;
}

/** In-memory twin of `needsFollowUpThreadWhere`, for annotating rows already loaded. */
export function isThreadNeedingFollowUp(
    thread: FollowUpThreadFields,
    contact_unsubscribed_at: Date | null,
    cutoff: Date,
): boolean {
    return (
        thread.channel === Channel.EMAIL &&
        thread.reply_state === ThreadReplyState.AWAITING_THEM &&
        !!thread.last_outbound_at &&
        thread.last_outbound_at.getTime() <= cutoff.getTime() &&
        !contact_unsubscribed_at &&
        (thread.origin === ThreadOrigin.MANUAL || thread.last_inbound_at !== null)
    );
}

/**
 * Sort tiers for send history - lower sorts first. Replies and pending follow-ups are the
 * things someone has to act on, so they float above ordinary (recency-ordered) history:
 * an unread reply, then a reply we haven't answered yet, then a conversation gone quiet.
 */
export const ThreadPriority = {
    UNREAD_REPLY: 0,
    AWAITING_OUR_REPLY: 1,
    NEEDS_FOLLOW_UP: 2,
    NONE: 3,
} as const;

export type ThreadPriority = (typeof ThreadPriority)[keyof typeof ThreadPriority];

export interface PriorityThreadFields extends FollowUpThreadFields {
    has_unread_reply: boolean;
}

export function threadPriority(
    thread: PriorityThreadFields,
    contact_unsubscribed_at: Date | null,
    cutoff: Date,
): ThreadPriority {
    if (thread.has_unread_reply) return ThreadPriority.UNREAD_REPLY;
    if (thread.reply_state === ThreadReplyState.AWAITING_US) return ThreadPriority.AWAITING_OUR_REPLY;
    if (isThreadNeedingFollowUp(thread, contact_unsubscribed_at, cutoff)) {
        return ThreadPriority.NEEDS_FOLLOW_UP;
    }
    return ThreadPriority.NONE;
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
    return !!a && !!b && a.getTime() === b.getTime();
}

/**
 * Per-message flags for the send-history table, where each row is one message. Only the row a
 * state actually hangs off is flagged - the message that received the latest reply, or the
 * latest email we sent - so a busy thread doesn't light up every row it ever contained. The
 * timestamps match exactly because the webhook / send transaction stamps both with one instant.
 */
export function messageThreadFlags(
    message: { direction: string; sent_at: Date | null; replied_at: Date | null },
    thread: PriorityThreadFields | null,
    contact_unsubscribed_at: Date | null,
    cutoff: Date,
) {
    const isLatestReplyTarget = !!thread && sameInstant(message.replied_at, thread.last_inbound_at);
    const isLatestSend =
        !!thread && message.direction === 'OUTBOUND' && sameInstant(message.sent_at, thread.last_outbound_at);

    const has_unread_reply = isLatestReplyTarget && thread!.has_unread_reply;
    const needs_reply =
        isLatestReplyTarget && thread!.reply_state === ThreadReplyState.AWAITING_US;
    const needs_follow_up =
        isLatestSend && isThreadNeedingFollowUp(thread!, contact_unsubscribed_at, cutoff);

    const priority: ThreadPriority = has_unread_reply
        ? ThreadPriority.UNREAD_REPLY
        : needs_reply
          ? ThreadPriority.AWAITING_OUR_REPLY
          : needs_follow_up
            ? ThreadPriority.NEEDS_FOLLOW_UP
            : ThreadPriority.NONE;

    return { has_unread_reply, needs_reply, needs_follow_up, priority };
}
