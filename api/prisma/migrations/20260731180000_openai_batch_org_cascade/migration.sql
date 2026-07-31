ALTER TABLE "openai_batch_jobs" DROP CONSTRAINT IF EXISTS "openai_batch_jobs_organisation_uuid_fkey";

ALTER TABLE "openai_batch_jobs"
ADD CONSTRAINT "openai_batch_jobs_organisation_uuid_fkey"
FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid")
ON DELETE CASCADE ON UPDATE CASCADE;
