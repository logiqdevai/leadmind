-- Reworks the FOLLOW_UP reminder's scoping key from sequence_enrollment_uuid to
-- outreach_message_uuid (reminders can now be started by a manual reply outside any
-- sequence, which has no enrollment to key off), and adds the is_manual_reply flag
-- that marks which OutreachMessage rows are allowed to start that clock.

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_sequence_enrollment_uuid_fkey";

-- DropIndex
DROP INDEX "reminders_sequence_enrollment_uuid_idx";

-- AlterTable
ALTER TABLE "reminders" DROP COLUMN "sequence_enrollment_uuid",
ADD COLUMN     "outreach_message_uuid" TEXT;

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN     "is_manual_reply" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "reminders_outreach_message_uuid_idx" ON "reminders"("outreach_message_uuid");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_outreach_message_uuid_fkey" FOREIGN KEY ("outreach_message_uuid") REFERENCES "OutreachMessage"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
