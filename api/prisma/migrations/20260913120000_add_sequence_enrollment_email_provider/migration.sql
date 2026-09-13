-- AlterTable
ALTER TABLE "sequence_enrollments" ADD COLUMN     "email_provider" "ExternalIntegrationProvider",
ADD COLUMN     "email_account" TEXT,
ADD COLUMN     "email_domain_uuid" TEXT;
