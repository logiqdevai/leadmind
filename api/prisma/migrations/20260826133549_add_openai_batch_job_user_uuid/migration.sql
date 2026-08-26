-- AlterTable
ALTER TABLE "openai_batch_jobs" ADD COLUMN     "user_uuid" TEXT;

-- CreateIndex
CREATE INDEX "openai_batch_jobs_organisation_uuid_user_uuid_idx" ON "openai_batch_jobs"("organisation_uuid", "user_uuid");

-- AddForeignKey
ALTER TABLE "openai_batch_jobs" ADD CONSTRAINT "openai_batch_jobs_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: attribute existing OpenAI batch jobs and unattributed bulk jobs to the
-- account that has historically operated them, so the new user_uuid columns aren't blank.
UPDATE "openai_batch_jobs"
SET "user_uuid" = (SELECT "uuid" FROM "users" WHERE "email" = 'petros@logiqdev.com' LIMIT 1)
WHERE "user_uuid" IS NULL;

UPDATE "bulk_jobs"
SET "created_by_user_uuid" = (SELECT "uuid" FROM "users" WHERE "email" = 'petros@logiqdev.com' LIMIT 1)
WHERE "created_by_user_uuid" IS NULL;
