-- AlterTable
ALTER TABLE "organisations" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateIndex
CREATE INDEX "OutreachMessage_organisation_uuid_sent_by_user_uuid_sent_at_idx" ON "OutreachMessage"("organisation_uuid", "sent_by_user_uuid", "sent_at");

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "GoalAchievementType" AS ENUM ('MILESTONE_25', 'MILESTONE_50', 'MILESTONE_75', 'GOAL_COMPLETE', 'PERSONAL_RECORD', 'LEADERBOARD_FIRST');

-- CreateTable
CREATE TABLE "messaging_goals" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "target_count" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_achievements" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "goal_uuid" TEXT NOT NULL,
    "type" "GoalAchievementType" NOT NULL,
    "period_key" TEXT NOT NULL,
    "payload" JSONB,
    "seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_personal_bests" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "best_count" INTEGER NOT NULL DEFAULT 0,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_personal_bests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "messaging_goals_uuid_key" ON "messaging_goals"("uuid");

-- CreateIndex
CREATE INDEX "messaging_goals_organisation_uuid_is_active_idx" ON "messaging_goals"("organisation_uuid", "is_active");

-- CreateIndex
CREATE INDEX "messaging_goals_user_uuid_is_active_idx" ON "messaging_goals"("user_uuid", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_goals_organisation_uuid_user_uuid_period_key" ON "messaging_goals"("organisation_uuid", "user_uuid", "period");

-- CreateIndex
CREATE UNIQUE INDEX "goal_achievements_uuid_key" ON "goal_achievements"("uuid");

-- CreateIndex
CREATE INDEX "goal_achievements_organisation_uuid_user_uuid_seen_at_idx" ON "goal_achievements"("organisation_uuid", "user_uuid", "seen_at");

-- CreateIndex
CREATE INDEX "goal_achievements_user_uuid_seen_at_idx" ON "goal_achievements"("user_uuid", "seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "goal_achievements_user_uuid_goal_uuid_type_period_key_key" ON "goal_achievements"("user_uuid", "goal_uuid", "type", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "goal_personal_bests_uuid_key" ON "goal_personal_bests"("uuid");

-- CreateIndex
CREATE INDEX "goal_personal_bests_organisation_uuid_user_uuid_idx" ON "goal_personal_bests"("organisation_uuid", "user_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "goal_personal_bests_organisation_uuid_user_uuid_period_key" ON "goal_personal_bests"("organisation_uuid", "user_uuid", "period");

-- AddForeignKey
ALTER TABLE "messaging_goals" ADD CONSTRAINT "messaging_goals_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_goals" ADD CONSTRAINT "messaging_goals_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_achievements" ADD CONSTRAINT "goal_achievements_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_achievements" ADD CONSTRAINT "goal_achievements_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_achievements" ADD CONSTRAINT "goal_achievements_goal_uuid_fkey" FOREIGN KEY ("goal_uuid") REFERENCES "messaging_goals"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_personal_bests" ADD CONSTRAINT "goal_personal_bests_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_personal_bests" ADD CONSTRAINT "goal_personal_bests_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
