-- Link a sender profile to a team member so booking emails can use the assignee's signature.
ALTER TABLE "sender_profiles" ADD COLUMN "user_uuid" TEXT;

CREATE INDEX "sender_profiles_user_uuid_idx" ON "sender_profiles"("user_uuid");

ALTER TABLE "sender_profiles" ADD CONSTRAINT "sender_profiles_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
