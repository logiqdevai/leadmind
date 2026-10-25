-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN "sender_profile_uuid" TEXT;

-- CreateIndex
CREATE INDEX "message_templates_sender_profile_uuid_idx" ON "message_templates"("sender_profile_uuid");

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_sender_profile_uuid_fkey" FOREIGN KEY ("sender_profile_uuid") REFERENCES "sender_profiles"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
