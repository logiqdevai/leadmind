-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PUBLIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "BookingLocationType" AS ENUM ('NONE', 'GOOGLE_MEET', 'PHONE', 'IN_PERSON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BookingAssignmentMode" AS ENUM ('ROUND_ROBIN', 'LEAST_BUSY');

-- CreateEnum
CREATE TYPE "BookingUnavailableSlotsMode" AS ENUM ('HIDE', 'SHOW_DISABLED');

-- CreateEnum
CREATE TYPE "BookingActorType" AS ENUM ('USER', 'INVITEE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BookingEventType" AS ENUM ('CREATED', 'CONFIRMED', 'ASSIGNED', 'RESCHEDULED', 'CANCELLED', 'STATUS_CHANGED', 'UPDATED', 'NOTE_UPDATED', 'NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'CALENDAR_SYNCED', 'CALENDAR_SYNC_FAILED');

-- CreateEnum
CREATE TYPE "BookingNotificationKind" AS ENUM ('CONFIRMATION', 'REMINDER', 'CANCELLATION', 'RESCHEDULE');

-- CreateEnum
CREATE TYPE "BookingNotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('NOT_SYNCED', 'PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('INITIATED', 'ACTIVE', 'EXPIRED', 'FAILED', 'DISCONNECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InteractionType" ADD VALUE 'BOOKING_SCHEDULED';
ALTER TYPE "InteractionType" ADD VALUE 'BOOKING_CANCELLED';

-- AlterEnum
ALTER TYPE "ExternalIntegrationProvider" ADD VALUE 'TYPESAFE';

-- AlterTable
ALTER TABLE "outreach_sequence_steps" ADD COLUMN     "append_booking_cta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "booking_page_uuid" TEXT;

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN     "append_booking_cta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "booking_page_uuid" TEXT;

-- CreateTable
CREATE TABLE "availability_schedules" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weekly_hours" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_overrides" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "schedule_uuid" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "intervals" JSONB NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_blocks" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_by_user_uuid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_pages" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "created_by_user_uuid" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "intro_text" TEXT,
    "brand_name" TEXT,
    "logo_url" TEXT,
    "primary_color" VARCHAR(9),
    "confirmation_message" TEXT,
    "redirect_url" TEXT,
    "cta_label" TEXT,
    "show_team_member" BOOLEAN NOT NULL DEFAULT true,
    "show_timezone" BOOLEAN NOT NULL DEFAULT true,
    "questions" JSONB,
    "require_phone" BOOLEAN NOT NULL DEFAULT false,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "duration_options" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "slot_interval_minutes" INTEGER,
    "min_notice_minutes" INTEGER NOT NULL DEFAULT 240,
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "min_gap_minutes" INTEGER NOT NULL DEFAULT 0,
    "max_gap_minutes" INTEGER,
    "max_bookings_per_day" INTEGER,
    "seats_per_slot" INTEGER NOT NULL DEFAULT 1,
    "assignment_mode" "BookingAssignmentMode" NOT NULL DEFAULT 'ROUND_ROBIN',
    "allow_invitee_member_choice" BOOLEAN NOT NULL DEFAULT false,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "unavailable_slots_mode" "BookingUnavailableSlotsMode" NOT NULL DEFAULT 'HIDE',
    "location_type" "BookingLocationType" NOT NULL DEFAULT 'GOOGLE_MEET',
    "location_value" TEXT,
    "allow_cancellation" BOOLEAN NOT NULL DEFAULT true,
    "allow_reschedule" BOOLEAN NOT NULL DEFAULT true,
    "cancellation_deadline_minutes" INTEGER NOT NULL DEFAULT 0,
    "reschedule_deadline_minutes" INTEGER NOT NULL DEFAULT 0,
    "require_cancellation_reason" BOOLEAN NOT NULL DEFAULT false,
    "send_confirmation_email" BOOLEAN NOT NULL DEFAULT true,
    "send_reminder_emails" BOOLEAN NOT NULL DEFAULT true,
    "reminder_offsets_minutes" INTEGER[] DEFAULT ARRAY[1440, 60]::INTEGER[],
    "send_cancellation_email" BOOLEAN NOT NULL DEFAULT true,
    "send_reschedule_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_assignee" BOOLEAN NOT NULL DEFAULT true,
    "additional_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "include_meeting_link" BOOLEAN NOT NULL DEFAULT true,
    "include_calendar_details" BOOLEAN NOT NULL DEFAULT true,
    "confirmation_template_uuid" TEXT,
    "reminder_template_uuid" TEXT,
    "cancellation_template_uuid" TEXT,
    "reschedule_template_uuid" TEXT,
    "calendar_event_title" TEXT,
    "calendar_event_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_page_members" (
    "id" SERIAL NOT NULL,
    "booking_page_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "last_assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_page_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_links" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "booking_page_uuid" TEXT NOT NULL,
    "contact_uuid" TEXT,
    "label" TEXT,
    "auto_create_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_uuid" TEXT,
    "deactivated_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "booking_page_uuid" TEXT,
    "booking_link_uuid" TEXT,
    "contact_uuid" TEXT,
    "assigned_user_uuid" TEXT,
    "created_by_user_uuid" TEXT,
    "source" "BookingSource" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "invitee_timezone" TEXT,
    "invitee_name" TEXT NOT NULL,
    "invitee_email" TEXT NOT NULL,
    "invitee_phone" TEXT,
    "invitee_notes" TEXT,
    "answers" JSONB,
    "internal_notes" TEXT,
    "location_type" "BookingLocationType" NOT NULL DEFAULT 'NONE',
    "location_value" TEXT,
    "meeting_url" TEXT,
    "calendar_connection_uuid" TEXT,
    "calendar_event_id" TEXT,
    "calendar_html_link" TEXT,
    "calendar_sync_status" "CalendarSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "calendar_sync_error" TEXT,
    "calendar_synced_at" TIMESTAMP(3),
    "manage_token" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_by" "BookingActorType",
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "booking_uuid" TEXT NOT NULL,
    "type" "BookingEventType" NOT NULL,
    "actor_type" "BookingActorType" NOT NULL,
    "actor_user_uuid" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_notifications" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "booking_uuid" TEXT NOT NULL,
    "kind" "BookingNotificationKind" NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" "BookingNotificationStatus" NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'GOOGLE',
    "composio_connected_account_id" TEXT,
    "pending_connected_account_id" TEXT,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'INITIATED',
    "account_email" TEXT,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "calendar_name" TEXT,
    "check_conflicts" BOOLEAN NOT NULL DEFAULT true,
    "last_error" TEXT,
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "availability_schedules_uuid_key" ON "availability_schedules"("uuid");

-- CreateIndex
CREATE INDEX "availability_schedules_user_uuid_idx" ON "availability_schedules"("user_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "availability_schedules_organisation_uuid_user_uuid_key" ON "availability_schedules"("organisation_uuid", "user_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "availability_overrides_uuid_key" ON "availability_overrides"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "availability_overrides_schedule_uuid_date_key" ON "availability_overrides"("schedule_uuid", "date");

-- CreateIndex
CREATE UNIQUE INDEX "booking_blocks_uuid_key" ON "booking_blocks"("uuid");

-- CreateIndex
CREATE INDEX "booking_blocks_organisation_uuid_start_at_idx" ON "booking_blocks"("organisation_uuid", "start_at");

-- CreateIndex
CREATE INDEX "booking_blocks_user_uuid_start_at_idx" ON "booking_blocks"("user_uuid", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_pages_uuid_key" ON "booking_pages"("uuid");

-- CreateIndex
CREATE INDEX "booking_pages_organisation_uuid_idx" ON "booking_pages"("organisation_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "booking_pages_organisation_uuid_slug_key" ON "booking_pages"("organisation_uuid", "slug");

-- CreateIndex
CREATE INDEX "booking_page_members_user_uuid_idx" ON "booking_page_members"("user_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "booking_page_members_booking_page_uuid_user_uuid_key" ON "booking_page_members"("booking_page_uuid", "user_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "booking_links_uuid_key" ON "booking_links"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "booking_links_code_key" ON "booking_links"("code");

-- CreateIndex
CREATE INDEX "booking_links_organisation_uuid_idx" ON "booking_links"("organisation_uuid");

-- CreateIndex
CREATE INDEX "booking_links_booking_page_uuid_contact_uuid_is_active_idx" ON "booking_links"("booking_page_uuid", "contact_uuid", "is_active");

-- CreateIndex
CREATE INDEX "booking_links_contact_uuid_idx" ON "booking_links"("contact_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_uuid_key" ON "bookings"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_manage_token_key" ON "bookings"("manage_token");

-- CreateIndex
CREATE INDEX "bookings_organisation_uuid_start_at_idx" ON "bookings"("organisation_uuid", "start_at");

-- CreateIndex
CREATE INDEX "bookings_organisation_uuid_status_idx" ON "bookings"("organisation_uuid", "status");

-- CreateIndex
CREATE INDEX "bookings_assigned_user_uuid_start_at_idx" ON "bookings"("assigned_user_uuid", "start_at");

-- CreateIndex
CREATE INDEX "bookings_booking_page_uuid_start_at_idx" ON "bookings"("booking_page_uuid", "start_at");

-- CreateIndex
CREATE INDEX "bookings_contact_uuid_idx" ON "bookings"("contact_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "booking_events_uuid_key" ON "booking_events"("uuid");

-- CreateIndex
CREATE INDEX "booking_events_booking_uuid_created_at_idx" ON "booking_events"("booking_uuid", "created_at");

-- CreateIndex
CREATE INDEX "booking_events_organisation_uuid_created_at_idx" ON "booking_events"("organisation_uuid", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_notifications_uuid_key" ON "booking_notifications"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "booking_notifications_dedupe_key_key" ON "booking_notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "booking_notifications_booking_uuid_idx" ON "booking_notifications"("booking_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_uuid_key" ON "calendar_connections"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_composio_connected_account_id_key" ON "calendar_connections"("composio_connected_account_id");

-- CreateIndex
CREATE INDEX "calendar_connections_user_uuid_idx" ON "calendar_connections"("user_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_organisation_uuid_user_uuid_provider_key" ON "calendar_connections"("organisation_uuid", "user_uuid", "provider");

-- CreateIndex
CREATE INDEX "outreach_sequence_steps_booking_page_uuid_idx" ON "outreach_sequence_steps"("booking_page_uuid");

-- CreateIndex
CREATE INDEX "message_templates_booking_page_uuid_idx" ON "message_templates"("booking_page_uuid");

-- AddForeignKey
ALTER TABLE "outreach_sequence_steps" ADD CONSTRAINT "outreach_sequence_steps_booking_page_uuid_fkey" FOREIGN KEY ("booking_page_uuid") REFERENCES "booking_pages"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_booking_page_uuid_fkey" FOREIGN KEY ("booking_page_uuid") REFERENCES "booking_pages"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_schedule_uuid_fkey" FOREIGN KEY ("schedule_uuid") REFERENCES "availability_schedules"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_created_by_user_uuid_fkey" FOREIGN KEY ("created_by_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_created_by_user_uuid_fkey" FOREIGN KEY ("created_by_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_confirmation_template_uuid_fkey" FOREIGN KEY ("confirmation_template_uuid") REFERENCES "message_templates"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_reminder_template_uuid_fkey" FOREIGN KEY ("reminder_template_uuid") REFERENCES "message_templates"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_cancellation_template_uuid_fkey" FOREIGN KEY ("cancellation_template_uuid") REFERENCES "message_templates"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_reschedule_template_uuid_fkey" FOREIGN KEY ("reschedule_template_uuid") REFERENCES "message_templates"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_page_members" ADD CONSTRAINT "booking_page_members_booking_page_uuid_fkey" FOREIGN KEY ("booking_page_uuid") REFERENCES "booking_pages"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_page_members" ADD CONSTRAINT "booking_page_members_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_booking_page_uuid_fkey" FOREIGN KEY ("booking_page_uuid") REFERENCES "booking_pages"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_contact_uuid_fkey" FOREIGN KEY ("contact_uuid") REFERENCES "Contact"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_created_by_user_uuid_fkey" FOREIGN KEY ("created_by_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_page_uuid_fkey" FOREIGN KEY ("booking_page_uuid") REFERENCES "booking_pages"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_link_uuid_fkey" FOREIGN KEY ("booking_link_uuid") REFERENCES "booking_links"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contact_uuid_fkey" FOREIGN KEY ("contact_uuid") REFERENCES "Contact"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_user_uuid_fkey" FOREIGN KEY ("assigned_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_user_uuid_fkey" FOREIGN KEY ("created_by_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_calendar_connection_uuid_fkey" FOREIGN KEY ("calendar_connection_uuid") REFERENCES "calendar_connections"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_uuid_fkey" FOREIGN KEY ("booking_uuid") REFERENCES "bookings"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_user_uuid_fkey" FOREIGN KEY ("actor_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notifications" ADD CONSTRAINT "booking_notifications_booking_uuid_fkey" FOREIGN KEY ("booking_uuid") REFERENCES "bookings"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- Time ranges must be non-empty (not expressible in the Prisma schema).
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_range_check" CHECK ("end_at" > "start_at");
ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_time_range_check" CHECK ("end_at" > "start_at");
