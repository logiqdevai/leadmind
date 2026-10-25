-- AlterTable
ALTER TABLE "sending_policies" ADD COLUMN     "allowed_weekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[];

-- AlterTable
ALTER TABLE "OutreachSequence" ADD COLUMN     "allowed_weekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[];
