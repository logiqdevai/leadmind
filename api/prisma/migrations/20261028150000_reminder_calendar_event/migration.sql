-- Link a reminder to the Google Calendar event created for it.
ALTER TABLE "reminders" ADD COLUMN "calendar_event_id" TEXT;
ALTER TABLE "reminders" ADD COLUMN "calendar_connection_uuid" TEXT;
