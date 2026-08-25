-- AlterEnum
ALTER TYPE "ExternalIntegrationProvider" ADD VALUE IF NOT EXISTS 'MXTOOLBOX';

-- AlterEnum
ALTER TYPE "AiUsageOperation" ADD VALUE IF NOT EXISTS 'MXTOOLBOX_AUDIT';

-- CreateEnum
CREATE TYPE "MxToolboxCheckStatus" AS ENUM ('PASSED', 'WARNING', 'FAILED');

-- CreateTable
CREATE TABLE "mxtoolbox_checks" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "label" TEXT,
    "domain" TEXT NOT NULL,
    "commands" TEXT[],
    "status" "MxToolboxCheckStatus" NOT NULL DEFAULT 'PASSED',
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL,
    "ai_audit" JSONB,
    "ai_audit_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mxtoolbox_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mxtoolbox_checks_uuid_key" ON "mxtoolbox_checks"("uuid");

-- CreateIndex
CREATE INDEX "mxtoolbox_checks_organisation_uuid_idx" ON "mxtoolbox_checks"("organisation_uuid");

-- AddForeignKey
ALTER TABLE "mxtoolbox_checks" ADD CONSTRAINT "mxtoolbox_checks_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
