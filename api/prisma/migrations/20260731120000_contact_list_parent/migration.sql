ALTER TABLE "contact_lists" ADD COLUMN "parent_list_uuid" TEXT;

CREATE INDEX "contact_lists_parent_list_uuid_idx" ON "contact_lists"("parent_list_uuid");

ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_parent_list_uuid_fkey" FOREIGN KEY ("parent_list_uuid") REFERENCES "contact_lists"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
