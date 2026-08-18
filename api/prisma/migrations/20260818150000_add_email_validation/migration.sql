-- CreateEnum
CREATE TYPE "EmailValidationStatus" AS ENUM ('UNKNOWN', 'VALID', 'INVALID');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "email_validated_at" TIMESTAMP(3),
ADD COLUMN     "email_validation_reason" TEXT,
ADD COLUMN     "email_validation_status" "EmailValidationStatus" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "email_validated_at" TIMESTAMP(3),
ADD COLUMN     "email_validation_reason" TEXT,
ADD COLUMN     "email_validation_status" "EmailValidationStatus" NOT NULL DEFAULT 'UNKNOWN';

