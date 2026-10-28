-- Booking pages can send several templates per email type; the one whose language matches the invitee's is used.

-- The language the invitee used on the public booking page (fallback when the contact has no country).
ALTER TABLE "bookings" ADD COLUMN "invitee_language" TEXT;

CREATE TABLE "booking_page_templates" (
    "id" SERIAL NOT NULL,
    "booking_page_uuid" TEXT NOT NULL,
    "template_uuid" TEXT NOT NULL,
    "kind" "BookingNotificationKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_page_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_page_templates_booking_page_uuid_kind_template_uuid_key" ON "booking_page_templates"("booking_page_uuid", "kind", "template_uuid");
CREATE INDEX "booking_page_templates_booking_page_uuid_kind_idx" ON "booking_page_templates"("booking_page_uuid", "kind");
CREATE INDEX "booking_page_templates_template_uuid_idx" ON "booking_page_templates"("template_uuid");

ALTER TABLE "booking_page_templates" ADD CONSTRAINT "booking_page_templates_booking_page_uuid_fkey" FOREIGN KEY ("booking_page_uuid") REFERENCES "booking_pages"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_page_templates" ADD CONSTRAINT "booking_page_templates_template_uuid_fkey" FOREIGN KEY ("template_uuid") REFERENCES "message_templates"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over the template each page already had selected for each email type.
INSERT INTO "booking_page_templates" ("booking_page_uuid", "template_uuid", "kind")
SELECT "uuid", "confirmation_template_uuid", 'CONFIRMATION'::"BookingNotificationKind" FROM "booking_pages" WHERE "confirmation_template_uuid" IS NOT NULL
UNION ALL
SELECT "uuid", "reminder_template_uuid", 'REMINDER'::"BookingNotificationKind" FROM "booking_pages" WHERE "reminder_template_uuid" IS NOT NULL
UNION ALL
SELECT "uuid", "cancellation_template_uuid", 'CANCELLATION'::"BookingNotificationKind" FROM "booking_pages" WHERE "cancellation_template_uuid" IS NOT NULL
UNION ALL
SELECT "uuid", "reschedule_template_uuid", 'RESCHEDULE'::"BookingNotificationKind" FROM "booking_pages" WHERE "reschedule_template_uuid" IS NOT NULL
ON CONFLICT DO NOTHING;

-- The single-template columns are replaced by the table above.
ALTER TABLE "booking_pages" DROP CONSTRAINT IF EXISTS "booking_pages_confirmation_template_uuid_fkey";
ALTER TABLE "booking_pages" DROP CONSTRAINT IF EXISTS "booking_pages_reminder_template_uuid_fkey";
ALTER TABLE "booking_pages" DROP CONSTRAINT IF EXISTS "booking_pages_cancellation_template_uuid_fkey";
ALTER TABLE "booking_pages" DROP CONSTRAINT IF EXISTS "booking_pages_reschedule_template_uuid_fkey";

ALTER TABLE "booking_pages"
    DROP COLUMN "confirmation_template_uuid",
    DROP COLUMN "reminder_template_uuid",
    DROP COLUMN "cancellation_template_uuid",
    DROP COLUMN "reschedule_template_uuid";
