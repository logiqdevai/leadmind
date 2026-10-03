-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "bounced_at" TIMESTAMP(3),
ADD COLUMN "bounce_reason" TEXT;

-- CreateIndex
CREATE INDEX "Contact_bounced_at_idx" ON "Contact"("bounced_at");
