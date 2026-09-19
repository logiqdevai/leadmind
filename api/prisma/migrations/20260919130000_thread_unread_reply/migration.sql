-- Unread-style flag for inbound replies: set when a contact replies, cleared when someone opens the
-- conversation or we send our own reply. Shared across the organisation (not per user).

-- AlterTable
ALTER TABLE "message_threads" ADD COLUMN     "has_unread_reply" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: replies from the past 7 days that we still owe an answer to show as unread; older
-- history is left read so the list doesn't open fully bold.
UPDATE "message_threads"
SET "has_unread_reply" = true
WHERE "reply_state" = 'AWAITING_US'
  AND "last_inbound_at" > (NOW() - INTERVAL '7 days');
