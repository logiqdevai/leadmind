-- Timeline entries for booking links emailed to contacts and their no-booking reminders.
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'BOOKING_LINK_SENT';
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'BOOKING_REMINDER_SENT';
