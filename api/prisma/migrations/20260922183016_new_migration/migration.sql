-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "created_by_user_uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "organisation_role" "OrganisationRole" NOT NULL DEFAULT 'MEMBER',
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_uuid_key" ON "api_keys"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_organisation_uuid_idx" ON "api_keys"("organisation_uuid");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_uuid_fkey" FOREIGN KEY ("created_by_user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
