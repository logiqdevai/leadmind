-- Manual "needs follow-up" flag on a conversation. Set by a user from send history; cleared when
-- they dismiss it, send on the thread, or the contact replies. Additive and nullable.

-- AlterTable
ALTER TABLE "message_threads" ADD COLUMN     "manual_follow_up_at" TIMESTAMP(3);
