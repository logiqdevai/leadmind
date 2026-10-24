-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('EMAIL', 'CALL');

-- AlterTable
ALTER TABLE "messaging_goals" ADD COLUMN "metric" "GoalMetric" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "goal_personal_bests" ADD COLUMN "metric" "GoalMetric" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "Interaction" ADD COLUMN "created_by_user_uuid" TEXT;

-- DropIndex
DROP INDEX "messaging_goals_organisation_uuid_user_uuid_period_key";
DROP INDEX "goal_personal_bests_organisation_uuid_user_uuid_period_key";

-- CreateIndex
CREATE UNIQUE INDEX "messaging_goals_organisation_uuid_user_uuid_period_metric_key" ON "messaging_goals"("organisation_uuid", "user_uuid", "period", "metric");
CREATE UNIQUE INDEX "goal_personal_bests_organisation_uuid_user_uuid_period_metric_key" ON "goal_personal_bests"("organisation_uuid", "user_uuid", "period", "metric");
CREATE INDEX "Interaction_created_by_user_uuid_type_created_at_idx" ON "Interaction"("created_by_user_uuid", "type", "created_at");
