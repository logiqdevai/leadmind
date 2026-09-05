-- CreateEnum
CREATE TYPE "ReminderSource" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('GENERAL', 'CALL', 'EMAIL', 'MEETING', 'TASK');

-- AlterEnum
ALTER TYPE "AiUsageOperation" ADD VALUE 'REPLY_ANALYSIS';

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "source" "ReminderSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "type" "ReminderType" NOT NULL DEFAULT 'GENERAL';
