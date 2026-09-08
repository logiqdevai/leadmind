-- CreateEnum
CREATE TYPE "ThreadOrigin" AS ENUM ('MANUAL', 'SEQUENCE', 'CAMPAIGN');

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN     "message_id" TEXT,
ADD COLUMN     "references" TEXT,
ADD COLUMN     "thread_uuid" TEXT;

-- CreateTable
CREATE TABLE "message_threads" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "contact_uuid" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "subject" TEXT,
    "origin" "ThreadOrigin" NOT NULL,
    "sequence_enrollment_uuid" TEXT,
    "campaign_uuid" TEXT,
    "dedupe_key" TEXT,
    "last_message_at" TIMESTAMP(3),
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_threads_uuid_key" ON "message_threads"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "message_threads_dedupe_key_key" ON "message_threads"("dedupe_key");

-- CreateIndex
CREATE INDEX "message_threads_organisation_uuid_contact_uuid_idx" ON "message_threads"("organisation_uuid", "contact_uuid");

-- CreateIndex
CREATE INDEX "message_threads_contact_uuid_channel_last_message_at_idx" ON "message_threads"("contact_uuid", "channel", "last_message_at");

-- CreateIndex
CREATE INDEX "OutreachMessage_thread_uuid_idx" ON "OutreachMessage"("thread_uuid");

-- CreateIndex
CREATE INDEX "OutreachMessage_message_id_idx" ON "OutreachMessage"("message_id");

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_thread_uuid_fkey" FOREIGN KEY ("thread_uuid") REFERENCES "message_threads"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_contact_uuid_fkey" FOREIGN KEY ("contact_uuid") REFERENCES "Contact"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
