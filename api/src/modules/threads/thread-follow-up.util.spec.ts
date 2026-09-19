/// <reference types="jest" />
import { Channel, ThreadOrigin, ThreadReplyState } from '@/generated/prisma';
import { FOLLOW_UP_DEFAULT_DELAY_DAYS } from '@/modules/reminders/reminders.constants';
import {
    followUpCutoff,
    isThreadNeedingFollowUp,
    messageThreadFlags,
    needsFollowUpThreadWhere,
    ThreadPriority,
    threadPriority,
} from './thread-follow-up.util';

describe('thread follow-up rule', () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const cutoff = followUpCutoff(now);
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const staleManualThread = {
        channel: Channel.EMAIL,
        origin: ThreadOrigin.MANUAL,
        reply_state: ThreadReplyState.AWAITING_THEM,
        last_inbound_at: null,
        last_outbound_at: daysAgo(FOLLOW_UP_DEFAULT_DELAY_DAYS + 1),
    };

    it('puts the cutoff FOLLOW_UP_DEFAULT_DELAY_DAYS before now', () => {
        expect(cutoff.getTime()).toBe(daysAgo(FOLLOW_UP_DEFAULT_DELAY_DAYS).getTime());
    });

    it('flags a manual thread we sent last that has been quiet past the window', () => {
        expect(isThreadNeedingFollowUp(staleManualThread, null, cutoff)).toBe(true);
    });

    it('treats a send exactly at the cutoff as due, and a fresher one as not yet', () => {
        expect(
            isThreadNeedingFollowUp({ ...staleManualThread, last_outbound_at: cutoff }, null, cutoff),
        ).toBe(true);
        expect(
            isThreadNeedingFollowUp(
                { ...staleManualThread, last_outbound_at: daysAgo(FOLLOW_UP_DEFAULT_DELAY_DAYS - 1) },
                null,
                cutoff,
            ),
        ).toBe(false);
    });

    it('does not flag a thread where the contact replied last (we owe them, not the reverse)', () => {
        expect(
            isThreadNeedingFollowUp(
                { ...staleManualThread, reply_state: ThreadReplyState.AWAITING_US },
                null,
                cutoff,
            ),
        ).toBe(false);
    });

    it('does not flag dismissed / closed threads', () => {
        expect(
            isThreadNeedingFollowUp(
                { ...staleManualThread, reply_state: ThreadReplyState.NONE },
                null,
                cutoff,
            ),
        ).toBe(false);
    });

    it('ignores cold campaign and sequence sends that never got a reply', () => {
        for (const origin of [ThreadOrigin.CAMPAIGN, ThreadOrigin.SEQUENCE]) {
            expect(isThreadNeedingFollowUp({ ...staleManualThread, origin }, null, cutoff)).toBe(false);
        }
    });

    it('includes campaign and sequence threads once the contact has replied at least once', () => {
        for (const origin of [ThreadOrigin.CAMPAIGN, ThreadOrigin.SEQUENCE]) {
            expect(
                isThreadNeedingFollowUp(
                    { ...staleManualThread, origin, last_inbound_at: daysAgo(10) },
                    null,
                    cutoff,
                ),
            ).toBe(true);
        }
    });

    it('never chases an unsubscribed contact', () => {
        expect(isThreadNeedingFollowUp(staleManualThread, daysAgo(1), cutoff)).toBe(false);
    });

    it('only applies to email threads (SMS replies are not ingested)', () => {
        expect(
            isThreadNeedingFollowUp({ ...staleManualThread, channel: Channel.SMS }, null, cutoff),
        ).toBe(false);
    });

    it('keeps the Prisma filter aligned with the in-memory rule', () => {
        expect(needsFollowUpThreadWhere(cutoff)).toEqual({
            channel: Channel.EMAIL,
            reply_state: ThreadReplyState.AWAITING_THEM,
            last_outbound_at: { lte: cutoff },
            contact: { unsubscribed_at: null },
            OR: [{ origin: ThreadOrigin.MANUAL }, { last_inbound_at: { not: null } }],
        });
    });

    describe('priority ordering', () => {
        const thread = { ...staleManualThread, has_unread_reply: false };

        it('ranks unread reply above an unanswered reply above a due follow-up above the rest', () => {
            const unread = threadPriority(
                { ...thread, reply_state: ThreadReplyState.AWAITING_US, has_unread_reply: true },
                null,
                cutoff,
            );
            const awaitingUs = threadPriority(
                { ...thread, reply_state: ThreadReplyState.AWAITING_US },
                null,
                cutoff,
            );
            const followUp = threadPriority(thread, null, cutoff);
            const idle = threadPriority({ ...thread, reply_state: ThreadReplyState.NONE }, null, cutoff);

            expect(unread).toBe(ThreadPriority.UNREAD_REPLY);
            expect(awaitingUs).toBe(ThreadPriority.AWAITING_OUR_REPLY);
            expect(followUp).toBe(ThreadPriority.NEEDS_FOLLOW_UP);
            expect(idle).toBe(ThreadPriority.NONE);
            expect([idle, followUp, awaitingUs, unread].sort((a, b) => a - b)).toEqual([
                unread,
                awaitingUs,
                followUp,
                idle,
            ]);
        });
    });

    describe('per-message flags', () => {
        const replyAt = daysAgo(1);
        const sentAt = daysAgo(FOLLOW_UP_DEFAULT_DELAY_DAYS + 2);
        const base = {
            ...staleManualThread,
            has_unread_reply: false,
            last_inbound_at: replyAt,
            last_outbound_at: sentAt,
        };

        it('flags only the message that received the latest reply as unread / needing a reply', () => {
            const thread = { ...base, reply_state: ThreadReplyState.AWAITING_US, has_unread_reply: true };
            const target = messageThreadFlags(
                { direction: 'OUTBOUND', sent_at: sentAt, replied_at: replyAt },
                thread,
                null,
                cutoff,
            );
            const earlier = messageThreadFlags(
                { direction: 'OUTBOUND', sent_at: daysAgo(20), replied_at: daysAgo(19) },
                thread,
                null,
                cutoff,
            );

            expect(target).toEqual(
                expect.objectContaining({
                    has_unread_reply: true,
                    needs_reply: true,
                    priority: ThreadPriority.UNREAD_REPLY,
                }),
            );
            expect(earlier.priority).toBe(ThreadPriority.NONE);
            expect(earlier.has_unread_reply).toBe(false);
        });

        it('separates "unread" from "still needs a reply" once someone has opened it', () => {
            const flags = messageThreadFlags(
                { direction: 'OUTBOUND', sent_at: sentAt, replied_at: replyAt },
                { ...base, reply_state: ThreadReplyState.AWAITING_US },
                null,
                cutoff,
            );
            expect(flags.has_unread_reply).toBe(false);
            expect(flags.needs_reply).toBe(true);
            expect(flags.priority).toBe(ThreadPriority.AWAITING_OUR_REPLY);
        });

        it('flags only the latest sent email as needing follow-up', () => {
            const latest = messageThreadFlags(
                { direction: 'OUTBOUND', sent_at: sentAt, replied_at: null },
                { ...base, last_inbound_at: null },
                null,
                cutoff,
            );
            const older = messageThreadFlags(
                { direction: 'OUTBOUND', sent_at: daysAgo(30), replied_at: null },
                { ...base, last_inbound_at: null },
                null,
                cutoff,
            );
            expect(latest.needs_follow_up).toBe(true);
            expect(latest.priority).toBe(ThreadPriority.NEEDS_FOLLOW_UP);
            expect(older.needs_follow_up).toBe(false);
        });

        it('returns no flags for a message without a thread', () => {
            expect(
                messageThreadFlags({ direction: 'OUTBOUND', sent_at: sentAt, replied_at: null }, null, null, cutoff),
            ).toEqual({
                has_unread_reply: false,
                needs_reply: false,
                needs_follow_up: false,
                priority: ThreadPriority.NONE,
            });
        });
    });
});
