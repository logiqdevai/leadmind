-- CreateEnum
CREATE TYPE "ContactInfoType" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'WEBSITE', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'WHATSAPP', 'TELEGRAM', 'YOUTUBE', 'GOOGLE_MAPS', 'OTHER');

-- CreateTable
CREATE TABLE "contact_infos" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "contact_uuid" TEXT NOT NULL,
    "type" "ContactInfoType" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_infos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_infos_uuid_key" ON "contact_infos"("uuid");

-- CreateIndex
CREATE INDEX "contact_infos_contact_uuid_idx" ON "contact_infos"("contact_uuid");

-- CreateIndex
CREATE INDEX "contact_infos_contact_uuid_type_idx" ON "contact_infos"("contact_uuid", "type");

-- AddForeignKey
ALTER TABLE "contact_infos" ADD CONSTRAINT "contact_infos_contact_uuid_fkey" FOREIGN KEY ("contact_uuid") REFERENCES "Contact"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
