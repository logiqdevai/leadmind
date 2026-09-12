-- AlterTable
ALTER TABLE "contact_list_members" ADD COLUMN     "status" "LeadStatus";

-- AlterTable
ALTER TABLE "sequence_enrollments" ADD COLUMN     "list_uuid" TEXT;

-- CreateIndex
CREATE INDEX "sequence_enrollments_list_uuid_idx" ON "sequence_enrollments"("list_uuid");

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_list_uuid_fkey" FOREIGN KEY ("list_uuid") REFERENCES "contact_lists"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
