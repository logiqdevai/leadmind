-- AlterEnum
ALTER TYPE "ReminderSource" ADD VALUE 'SYSTEM';

-- AlterEnum
ALTER TYPE "ReminderType" ADD VALUE 'FOLLOW_UP';

-- AlterEnum
ALTER TYPE "AiUsageOperation" ADD VALUE 'FOLLOW_UP_DRAFT';

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN     "inbound_message_id" TEXT,
ADD COLUMN     "in_reply_to_message_id" TEXT;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "sequence_enrollment_uuid" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "reminders_sequence_enrollment_uuid_idx" ON "reminders"("sequence_enrollment_uuid");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_sequence_enrollment_uuid_fkey" FOREIGN KEY ("sequence_enrollment_uuid") REFERENCES "sequence_enrollments"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
