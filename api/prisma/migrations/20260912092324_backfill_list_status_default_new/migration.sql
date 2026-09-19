-- Backfill existing NULL list-scoped statuses to NEW before enforcing NOT NULL,
-- so every ContactListMember row has an explicit status going forward.
UPDATE "contact_list_members" SET "status" = 'NEW' WHERE "status" IS NULL;

-- AlterTable
ALTER TABLE "contact_list_members" ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'NEW';
