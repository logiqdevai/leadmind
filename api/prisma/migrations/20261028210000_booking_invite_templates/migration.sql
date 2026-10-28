-- Message templates an organisation offers for booking-link emails; the one matching the contact's language is sent.
CREATE TYPE "BookingInviteTemplateKind" AS ENUM ('INVITE', 'REMINDER');

CREATE TABLE "booking_invite_templates" (
    "id" SERIAL NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "template_uuid" TEXT NOT NULL,
    "kind" "BookingInviteTemplateKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_invite_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_invite_templates_organisation_uuid_kind_template_uuid_key" ON "booking_invite_templates"("organisation_uuid", "kind", "template_uuid");
CREATE INDEX "booking_invite_templates_organisation_uuid_kind_idx" ON "booking_invite_templates"("organisation_uuid", "kind");
CREATE INDEX "booking_invite_templates_template_uuid_idx" ON "booking_invite_templates"("template_uuid");

ALTER TABLE "booking_invite_templates" ADD CONSTRAINT "booking_invite_templates_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_invite_templates" ADD CONSTRAINT "booking_invite_templates_template_uuid_fkey" FOREIGN KEY ("template_uuid") REFERENCES "message_templates"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
