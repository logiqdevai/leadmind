-- Booking links emailed to contacts, with organisation-wide reminder defaults.

-- CreateEnum
CREATE TYPE "BookingInviteUnit" AS ENUM ('HOURS', 'DAYS', 'WEEKS');
CREATE TYPE "BookingInvitationStatus" AS ENUM ('ACTIVE', 'BOOKED', 'STOPPED');

-- CreateTable
CREATE TABLE "booking_invite_settings" (
    "id" SERIAL NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_delay_value" INTEGER NOT NULL DEFAULT 3,
    "reminder_delay_unit" "BookingInviteUnit" NOT NULL DEFAULT 'DAYS',
    "max_reminders" INTEGER NOT NULL DEFAULT 1,
    "invite_subject" TEXT,
    "invite_message" TEXT,
    "reminder_subject" TEXT,
    "reminder_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_invite_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_invitations" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "booking_page_uuid" TEXT NOT NULL,
    "booking_link_uuid" TEXT NOT NULL,
    "contact_uuid" TEXT NOT NULL,
    "sent_by_user_uuid" TEXT,
    "recipient_email" TEXT NOT NULL,
    "status" "BookingInvitationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder_delay_minutes" INTEGER NOT NULL DEFAULT 0,
    "max_reminders" INTEGER NOT NULL DEFAULT 0,
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "next_reminder_at" TIMESTAMP(3),
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_invite_settings_organisation_uuid_key" ON "booking_invite_settings"("organisation_uuid");
CREATE UNIQUE INDEX "booking_invitations_uuid_key" ON "booking_invitations"("uuid");
CREATE INDEX "booking_invitations_organisation_uuid_idx" ON "booking_invitations"("organisation_uuid");
CREATE INDEX "booking_invitations_contact_uuid_sent_at_idx" ON "booking_invitations"("contact_uuid", "sent_at");
CREATE INDEX "booking_invitations_booking_link_uuid_idx" ON "booking_invitations"("booking_link_uuid");

-- AddForeignKey
ALTER TABLE "booking_invite_settings" ADD CONSTRAINT "booking_invite_settings_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_invitations" ADD CONSTRAINT "booking_invitations_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_invitations" ADD CONSTRAINT "booking_invitations_booking_page_uuid_fkey" FOREIGN KEY ("booking_page_uuid") REFERENCES "booking_pages"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_invitations" ADD CONSTRAINT "booking_invitations_booking_link_uuid_fkey" FOREIGN KEY ("booking_link_uuid") REFERENCES "booking_links"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_invitations" ADD CONSTRAINT "booking_invitations_contact_uuid_fkey" FOREIGN KEY ("contact_uuid") REFERENCES "Contact"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
