-- Columns and constraints that were added to the appointment booking tables after migration
-- 20261026090000_appointment_booking had already been applied to some databases (an applied migration is
-- never re-run, so editing it in place left those databases without them).
--
-- Every statement is idempotent: databases that already have a column (because they ran the final version of
-- 20261026090000_appointment_booking) are left untouched.

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "BookingUnavailableSlotsMode" AS ENUM ('HIDE', 'SHOW_DISABLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "booking_pages" ADD COLUMN IF NOT EXISTS "unavailable_slots_mode" "BookingUnavailableSlotsMode" NOT NULL DEFAULT 'HIDE';
ALTER TABLE "booking_pages" ADD COLUMN IF NOT EXISTS "create_team_reminder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "booking_pages" ADD COLUMN IF NOT EXISTS "team_reminder_offset_minutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reminder_uuid" TEXT;

-- AlterTable
ALTER TABLE "calendar_connections" ADD COLUMN IF NOT EXISTS "pending_connected_account_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_reminder_uuid_key" ON "bookings"("reminder_uuid");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reminder_uuid_fkey" FOREIGN KEY ("reminder_uuid") REFERENCES "reminders"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
