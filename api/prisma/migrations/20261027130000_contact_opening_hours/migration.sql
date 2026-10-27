-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "opening_hours" JSONB;

-- CreateTable
CREATE TABLE "contact_opening_hours" (
    "id" SERIAL NOT NULL,
    "contact_uuid" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "opens_minute" INTEGER NOT NULL,
    "closes_minute" INTEGER NOT NULL,

    CONSTRAINT "contact_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_opening_hours_contact_uuid_idx" ON "contact_opening_hours"("contact_uuid");

-- CreateIndex
CREATE INDEX "contact_opening_hours_day_of_week_opens_minute_closes_minute_idx" ON "contact_opening_hours"("day_of_week", "opens_minute", "closes_minute");

-- AddForeignKey
ALTER TABLE "contact_opening_hours" ADD CONSTRAINT "contact_opening_hours_contact_uuid_fkey" FOREIGN KEY ("contact_uuid") REFERENCES "Contact"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
