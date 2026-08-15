-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BulkJobType" AS ENUM (
  'CONTACT_EMAIL_SCRAPE',
  'FILTER_SCRAPE',
  'CONTACT_SCORE',
  'CONTACT_ENRICH',
  'LEAD_ENRICH',
  'AI_DRAFT_MESSAGES',
  'CAMPAIGN_DISPATCH',
  'CAMPAIGN_MESSAGE_SEND',
  'OPENAI_BATCH',
  'OTHER'
);

-- CreateTable
CREATE TABLE "bulk_jobs" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "created_by_user_uuid" TEXT,
    "title" TEXT NOT NULL,
    "type" "BulkJobType" NOT NULL,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "progress_current" INTEGER NOT NULL DEFAULT 0,
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "queue_name" TEXT,
    "queue_job_id" TEXT,
    "reference_type" TEXT,
    "reference_uuid" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bulk_jobs_uuid_key" ON "bulk_jobs"("uuid");

-- CreateIndex
CREATE INDEX "bulk_jobs_organisation_uuid_status_idx" ON "bulk_jobs"("organisation_uuid", "status");

-- CreateIndex
CREATE INDEX "bulk_jobs_organisation_uuid_created_at_idx" ON "bulk_jobs"("organisation_uuid", "created_at");

-- CreateIndex
CREATE INDEX "bulk_jobs_organisation_uuid_type_idx" ON "bulk_jobs"("organisation_uuid", "type");

-- CreateIndex
CREATE INDEX "bulk_jobs_status_updated_at_idx" ON "bulk_jobs"("status", "updated_at");

-- CreateIndex
CREATE INDEX "bulk_jobs_queue_name_queue_job_id_idx" ON "bulk_jobs"("queue_name", "queue_job_id");

-- CreateIndex
CREATE INDEX "bulk_jobs_reference_type_reference_uuid_idx" ON "bulk_jobs"("reference_type", "reference_uuid");

-- AddForeignKey
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_created_by_user_uuid_fkey" FOREIGN KEY ("created_by_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
