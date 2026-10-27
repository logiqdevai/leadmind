-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REMINDER_DUE', 'BOOKING_CREATED', 'BOOKING_REQUESTED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'BOOKING_ASSIGNED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entity_type" TEXT,
    "entity_uuid" TEXT,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_uuid_key" ON "notifications"("uuid");

-- CreateIndex
CREATE INDEX "notifications_user_uuid_organisation_uuid_created_at_idx" ON "notifications"("user_uuid", "organisation_uuid", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_uuid_organisation_uuid_read_at_idx" ON "notifications"("user_uuid", "organisation_uuid", "read_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
