-- Assignee emails become an explicit opt-in per booking page.
ALTER TABLE "booking_pages" ALTER COLUMN "notify_assignee" SET DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "booking_recurring_blocks" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT,
    "weekdays" INTEGER[],
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "reason" TEXT,
    "created_by_user_uuid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_recurring_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_recurring_blocks_uuid_key" ON "booking_recurring_blocks"("uuid");
CREATE INDEX IF NOT EXISTS "booking_recurring_blocks_organisation_uuid_idx" ON "booking_recurring_blocks"("organisation_uuid");
CREATE INDEX IF NOT EXISTS "booking_recurring_blocks_user_uuid_idx" ON "booking_recurring_blocks"("user_uuid");

ALTER TABLE "booking_recurring_blocks" ADD CONSTRAINT "booking_recurring_blocks_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_recurring_blocks" ADD CONSTRAINT "booking_recurring_blocks_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_recurring_blocks" ADD CONSTRAINT "booking_recurring_blocks_created_by_user_uuid_fkey" FOREIGN KEY ("created_by_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
