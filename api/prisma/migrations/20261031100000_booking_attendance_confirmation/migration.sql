-- AlterTable
ALTER TABLE "booking_links" ADD COLUMN "require_attendance_confirmation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "attendance_confirmation_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "attendance_confirmed_at" TIMESTAMP(3);
