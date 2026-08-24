-- AlterEnum
ALTER TYPE "ExternalIntegrationProvider" ADD VALUE IF NOT EXISTS 'MAILTESTER';

-- CreateEnum
CREATE TYPE "MailTesterTestStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "mail_tester_tests" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "label" TEXT,
    "test_identifier" TEXT NOT NULL,
    "test_address" TEXT NOT NULL,
    "from_provider" "ExternalIntegrationProvider" NOT NULL,
    "from_account" TEXT NOT NULL,
    "status" "MailTesterTestStatus" NOT NULL DEFAULT 'PENDING',
    "score" DOUBLE PRECISION,
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_tester_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_tester_tests_uuid_key" ON "mail_tester_tests"("uuid");

-- CreateIndex
CREATE INDEX "mail_tester_tests_organisation_uuid_idx" ON "mail_tester_tests"("organisation_uuid");

-- AddForeignKey
ALTER TABLE "mail_tester_tests" ADD CONSTRAINT "mail_tester_tests_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
