-- CreateTable
CREATE TABLE "integration_accounts" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "integration_uuid" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_accounts_uuid_key" ON "integration_accounts"("uuid");

-- CreateIndex
CREATE INDEX "integration_accounts_integration_uuid_idx" ON "integration_accounts"("integration_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "integration_accounts_integration_uuid_account_key" ON "integration_accounts"("integration_uuid", "account");

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_integration_uuid_fkey" FOREIGN KEY ("integration_uuid") REFERENCES "integrations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill titles from existing key accounts (default title = account slug)
INSERT INTO "integration_accounts" ("uuid", "integration_uuid", "account", "title", "created_at", "updated_at")
SELECT gen_random_uuid()::text, k."integration_uuid", k."account", k."account", NOW(), NOW()
FROM (
    SELECT DISTINCT "integration_uuid", "account"
    FROM "integration_keys"
) k;
