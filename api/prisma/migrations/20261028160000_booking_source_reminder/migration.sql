-- Bookings made as placeholders for reminders that were added to Google Calendar.
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'REMINDER';

ALTER TABLE "bookings" ADD COLUMN "source_reminder_uuid" TEXT;
CREATE UNIQUE INDEX "bookings_source_reminder_uuid_key" ON "bookings"("source_reminder_uuid");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_reminder_uuid_fkey" FOREIGN KEY ("source_reminder_uuid") REFERENCES "reminders"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
