-- AlterTable
ALTER TABLE "contact_lists" ADD COLUMN "assigned_user_uuid" TEXT;

-- CreateIndex
CREATE INDEX "contact_lists_assigned_user_uuid_idx" ON "contact_lists"("assigned_user_uuid");

-- AddForeignKey
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_assigned_user_uuid_fkey" FOREIGN KEY ("assigned_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
