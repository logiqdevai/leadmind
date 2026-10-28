-- Log a COMPLETED meeting on the contact when a booking is marked completed (on by default, including existing pages).
ALTER TABLE "booking_pages" ADD COLUMN "auto_log_meeting" BOOLEAN NOT NULL DEFAULT true;
