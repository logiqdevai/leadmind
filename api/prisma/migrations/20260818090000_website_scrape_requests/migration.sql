-- AlterTable
ALTER TABLE "bulk_jobs" ADD COLUMN "progress_failed" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "WebsiteScrapeProvider" AS ENUM ('SCRAPIO');

-- CreateEnum
CREATE TYPE "WebsiteScrapeOperation" AS ENUM ('CONTACT_EMAIL_SCRAPE', 'LEAD_WEBSITE_ENRICHMENT', 'CONTACT_WEBSITE_ENRICHMENT');

-- CreateEnum
CREATE TYPE "WebsiteScrapeStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "website_scrape_requests" (
    "id" TEXT NOT NULL,
    "provider" "WebsiteScrapeProvider" NOT NULL DEFAULT 'SCRAPIO',
    "provider_run_id" TEXT NOT NULL,
    "provider_config_id" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "operation" "WebsiteScrapeOperation" NOT NULL,
    "reference_uuid" TEXT NOT NULL,
    "status" "WebsiteScrapeStatus" NOT NULL DEFAULT 'PENDING',
    "context" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "website_scrape_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_scrape_requests_provider_run_id_key" ON "website_scrape_requests"("provider_run_id");

-- CreateIndex
CREATE INDEX "website_scrape_requests_organisation_uuid_status_idx" ON "website_scrape_requests"("organisation_uuid", "status");

-- CreateIndex
CREATE INDEX "website_scrape_requests_operation_reference_uuid_idx" ON "website_scrape_requests"("operation", "reference_uuid");

-- AddForeignKey
ALTER TABLE "website_scrape_requests" ADD CONSTRAINT "website_scrape_requests_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
