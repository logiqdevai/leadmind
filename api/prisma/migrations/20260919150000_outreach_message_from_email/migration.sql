-- The From address an email actually went out as, recorded at send time. Older messages keep
-- NULL and are resolved from the account configuration when shown. Additive and nullable.

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN     "from_email" TEXT;
