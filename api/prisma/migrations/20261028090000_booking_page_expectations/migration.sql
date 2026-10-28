-- "What to expect" bullet points shown on the public booking page.
ALTER TABLE "booking_pages" ADD COLUMN IF NOT EXISTS "expectations" TEXT[] DEFAULT ARRAY[]::TEXT[];
