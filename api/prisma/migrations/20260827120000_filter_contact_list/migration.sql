ALTER TABLE "Filter" ADD COLUMN "contact_list_uuid" TEXT;

CREATE INDEX "Filter_contact_list_uuid_idx" ON "Filter"("contact_list_uuid");

ALTER TABLE "Filter" ADD CONSTRAINT "Filter_contact_list_uuid_fkey" FOREIGN KEY ("contact_list_uuid") REFERENCES "contact_lists"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
