-- AlterTable
ALTER TABLE "OutreachSequence" ADD COLUMN "sender_profile_uuid" TEXT;

-- CreateIndex
CREATE INDEX "OutreachSequence_sender_profile_uuid_idx" ON "OutreachSequence"("sender_profile_uuid");

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_sender_profile_uuid_fkey" FOREIGN KEY ("sender_profile_uuid") REFERENCES "sender_profiles"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
