-- Optional company name given by the invitee; also saved on the linked contact.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "invitee_company" TEXT;
