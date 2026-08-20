-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SequenceDelayUnit" AS ENUM ('HOURS', 'DAYS', 'WEEKS', 'MONTHS');

-- CreateEnum
CREATE TYPE "SequenceDelayReference" AS ENUM ('FIRST_STEP', 'PREVIOUS_STEP');

-- CreateEnum
CREATE TYPE "SequenceEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CampaignType" ADD VALUE 'SEQUENCE';

-- AlterTable
ALTER TABLE "OutreachSequence" DROP COLUMN "steps",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN     "sequence_enrollment_uuid" TEXT,
ADD COLUMN     "sequence_step_uuid" TEXT;

-- AlterTable
ALTER TABLE "marketing_campaigns" ADD COLUMN     "sequence_uuid" TEXT;

-- CreateTable
CREATE TABLE "outreach_sequence_steps" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "sequence_uuid" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channel" "Channel" NOT NULL,
    "email_subject" TEXT,
    "email_content" TEXT,
    "sms_content" TEXT,
    "message_template_uuid" TEXT,
    "delay_value" INTEGER NOT NULL,
    "delay_unit" "SequenceDelayUnit" NOT NULL DEFAULT 'HOURS',
    "delay_reference" "SequenceDelayReference" NOT NULL DEFAULT 'PREVIOUS_STEP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_enrollments" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "sequence_uuid" TEXT NOT NULL,
    "contact_uuid" TEXT NOT NULL,
    "campaign_uuid" TEXT,
    "status" "SequenceEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outreach_sequence_steps_uuid_key" ON "outreach_sequence_steps"("uuid");

-- CreateIndex
CREATE INDEX "outreach_sequence_steps_sequence_uuid_idx" ON "outreach_sequence_steps"("sequence_uuid");

-- CreateIndex
CREATE INDEX "outreach_sequence_steps_sequence_uuid_order_index_idx" ON "outreach_sequence_steps"("sequence_uuid", "order_index");

-- CreateIndex
CREATE INDEX "outreach_sequence_steps_message_template_uuid_idx" ON "outreach_sequence_steps"("message_template_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_enrollments_uuid_key" ON "sequence_enrollments"("uuid");

-- CreateIndex
CREATE INDEX "sequence_enrollments_sequence_uuid_idx" ON "sequence_enrollments"("sequence_uuid");

-- CreateIndex
CREATE INDEX "sequence_enrollments_contact_uuid_idx" ON "sequence_enrollments"("contact_uuid");

-- CreateIndex
CREATE INDEX "sequence_enrollments_campaign_uuid_idx" ON "sequence_enrollments"("campaign_uuid");

-- CreateIndex
CREATE INDEX "sequence_enrollments_sequence_uuid_contact_uuid_status_idx" ON "sequence_enrollments"("sequence_uuid", "contact_uuid", "status");

-- CreateIndex
CREATE INDEX "sequence_enrollments_status_idx" ON "sequence_enrollments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_enrollments_target_key" ON "sequence_enrollments"("sequence_uuid", "contact_uuid", "campaign_uuid");

-- CreateIndex
CREATE INDEX "OutreachMessage_sequence_enrollment_uuid_idx" ON "OutreachMessage"("sequence_enrollment_uuid");

-- CreateIndex
CREATE INDEX "OutreachMessage_sequence_step_uuid_idx" ON "OutreachMessage"("sequence_step_uuid");

-- CreateIndex
CREATE INDEX "marketing_campaigns_sequence_uuid_idx" ON "marketing_campaigns"("sequence_uuid");

-- AddForeignKey
ALTER TABLE "outreach_sequence_steps" ADD CONSTRAINT "outreach_sequence_steps_sequence_uuid_fkey" FOREIGN KEY ("sequence_uuid") REFERENCES "OutreachSequence"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_sequence_steps" ADD CONSTRAINT "outreach_sequence_steps_message_template_uuid_fkey" FOREIGN KEY ("message_template_uuid") REFERENCES "message_templates"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_uuid_fkey" FOREIGN KEY ("sequence_uuid") REFERENCES "OutreachSequence"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_contact_uuid_fkey" FOREIGN KEY ("contact_uuid") REFERENCES "Contact"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_campaign_uuid_fkey" FOREIGN KEY ("campaign_uuid") REFERENCES "marketing_campaigns"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_sequence_enrollment_uuid_fkey" FOREIGN KEY ("sequence_enrollment_uuid") REFERENCES "sequence_enrollments"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_sequence_step_uuid_fkey" FOREIGN KEY ("sequence_step_uuid") REFERENCES "outreach_sequence_steps"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_sequence_uuid_fkey" FOREIGN KEY ("sequence_uuid") REFERENCES "OutreachSequence"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
