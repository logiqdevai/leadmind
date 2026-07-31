-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN "bounced_at" TIMESTAMP(3);
ALTER TABLE "OutreachMessage" ADD COLUMN "failed_at" TIMESTAMP(3);
