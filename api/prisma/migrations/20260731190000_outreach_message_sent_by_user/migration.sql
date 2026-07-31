-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN "sent_by_user_uuid" TEXT;

-- CreateIndex
CREATE INDEX "OutreachMessage_sent_by_user_uuid_idx" ON "OutreachMessage"("sent_by_user_uuid");

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_sent_by_user_uuid_fkey" FOREIGN KEY ("sent_by_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
