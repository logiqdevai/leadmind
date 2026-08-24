-- AlterEnum
ALTER TYPE "AiUsageOperation" ADD VALUE IF NOT EXISTS 'MAIL_TESTER_AUDIT';

-- AlterTable
ALTER TABLE "mail_tester_tests" ADD COLUMN "ai_audit" JSONB,
ADD COLUMN "ai_audit_generated_at" TIMESTAMP(3);
