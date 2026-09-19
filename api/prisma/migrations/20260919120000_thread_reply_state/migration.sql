-- Persists whose turn it is in each conversation (last inbound / last outbound / reply_state)
-- so "needs reply" and "needs follow-up" are queryable instead of being recomputed from
-- interactions on every read.

-- CreateEnum
CREATE TYPE "ThreadReplyState" AS ENUM ('NONE', 'AWAITING_US', 'AWAITING_THEM');

-- AlterTable
ALTER TABLE "message_threads" ADD COLUMN     "last_inbound_at" TIMESTAMP(3),
ADD COLUMN     "last_outbound_at" TIMESTAMP(3),
ADD COLUMN     "reply_state" "ThreadReplyState" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "message_threads_org_reply_state_last_outbound_idx" ON "message_threads"("organisation_uuid", "reply_state", "last_outbound_at");

-- Backfill: latest email that actually went out per thread (bounced/failed/skipped sends don't count).
UPDATE "message_threads" AS t
SET "last_outbound_at" = s."last_outbound_at"
FROM (
    SELECT "thread_uuid", MAX("sent_at") AS "last_outbound_at"
    FROM "OutreachMessage"
    WHERE "thread_uuid" IS NOT NULL
      AND "direction" = 'OUTBOUND'
      AND "channel" = 'EMAIL'
      AND "sent_at" IS NOT NULL
      AND "status" IN ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED')
    GROUP BY "thread_uuid"
) AS s
WHERE t."uuid" = s."thread_uuid";

-- Backfill: latest inbound reply per thread, from the REPLY_RECEIVED interaction history.
UPDATE "message_threads" AS t
SET "last_inbound_at" = r."last_inbound_at"
FROM (
    SELECT m."thread_uuid", MAX(i."created_at") AS "last_inbound_at"
    FROM "Interaction" AS i
    JOIN "OutreachMessage" AS m ON m."uuid" = i."outreach_message_uuid"
    WHERE i."type" = 'REPLY_RECEIVED'
      AND m."thread_uuid" IS NOT NULL
    GROUP BY m."thread_uuid"
) AS r
WHERE t."uuid" = r."thread_uuid";

-- Backfill: derive the state. Threads where we're the one waiting are only reopened if the last
-- email went out in the past 30 days - older silent threads are left closed so the follow-up
-- filter doesn't open with months of stale history.
UPDATE "message_threads"
SET "reply_state" = CASE
    WHEN "last_inbound_at" IS NOT NULL
         AND ("last_outbound_at" IS NULL OR "last_inbound_at" > "last_outbound_at")
        THEN 'AWAITING_US'::"ThreadReplyState"
    WHEN "last_outbound_at" IS NOT NULL
         AND "last_outbound_at" > (NOW() - INTERVAL '30 days')
        THEN 'AWAITING_THEM'::"ThreadReplyState"
    ELSE 'NONE'::"ThreadReplyState"
END
WHERE "channel" = 'EMAIL';
