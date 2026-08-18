-- CreateTable
CREATE TABLE "saved_contact_filters" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_contact_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_contact_filters_uuid_key" ON "saved_contact_filters"("uuid");

-- CreateIndex
CREATE INDEX "saved_contact_filters_organisation_uuid_idx" ON "saved_contact_filters"("organisation_uuid");

-- AddForeignKey
ALTER TABLE "saved_contact_filters" ADD CONSTRAINT "saved_contact_filters_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
