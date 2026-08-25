-- AlterTable
ALTER TABLE "campaign_integrations" ADD COLUMN     "integration_account_domain_uuid" TEXT;

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN     "email_domain_uuid" TEXT;

-- CreateTable
CREATE TABLE "integration_account_domains" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "integration_account_uuid" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_account_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_account_domains_uuid_key" ON "integration_account_domains"("uuid");

-- CreateIndex
CREATE INDEX "integration_account_domains_integration_account_uuid_idx" ON "integration_account_domains"("integration_account_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "integration_account_domains_integration_account_uuid_from__key" ON "integration_account_domains"("integration_account_uuid", "from_email");

-- CreateIndex
CREATE INDEX "campaign_integrations_integration_account_domain_uuid_idx" ON "campaign_integrations"("integration_account_domain_uuid");

-- AddForeignKey
ALTER TABLE "integration_account_domains" ADD CONSTRAINT "integration_account_domains_integration_account_uuid_fkey" FOREIGN KEY ("integration_account_uuid") REFERENCES "integration_accounts"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_integrations" ADD CONSTRAINT "campaign_integrations_integration_account_domain_uuid_fkey" FOREIGN KEY ("integration_account_domain_uuid") REFERENCES "integration_account_domains"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: migrate existing Resend FROM_EMAIL keys as each account's default domain.
-- NOTE: integration_keys.secret is AES-encrypted app-side; this only handles plaintext
-- storage schemes. Run api/scripts/backfill-resend-domains.ts (app-level, decrypts with
-- INTEGRATIONS_ENCRYPTION_KEY) after this migration to populate real domain rows.
