-- CreateEnum
CREATE TYPE "DomainValidationStatus" AS ENUM ('UNKNOWN', 'VALID', 'INVALID');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "website_validated_at" TIMESTAMP(3),
ADD COLUMN     "website_validation_reason" TEXT,
ADD COLUMN     "website_validation_status" "DomainValidationStatus" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "website_validated_at" TIMESTAMP(3),
ADD COLUMN     "website_validation_reason" TEXT,
ADD COLUMN     "website_validation_status" "DomainValidationStatus" NOT NULL DEFAULT 'UNKNOWN';
