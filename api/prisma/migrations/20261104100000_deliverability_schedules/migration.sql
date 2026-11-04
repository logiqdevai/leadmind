-- Scheduled domain deliverability checks, their runs, and the per-schedule sending guard.
CREATE TYPE "DeliverabilityFrequency" AS ENUM ('DAILY', 'WEEKLY', 'EVERY_N_DAYS', 'MONTHLY');
CREATE TYPE "DeliverabilityActionMode" AS ENUM ('RECOMMEND', 'THROTTLE', 'PAUSE');
CREATE TYPE "DeliverabilityRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "DeliverabilityRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TYPE "SendingUsageScopeType" ADD VALUE 'DELIVERABILITY_GUARD';

CREATE TABLE "deliverability_schedules" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "label" TEXT,
    "domain" TEXT NOT NULL,
    "integration_account_uuid" TEXT,
    "integration_account_domain_uuid" TEXT,
    "from_provider" "ExternalIntegrationProvider",
    "from_account" TEXT,
    "dkim_selector" TEXT,
    "frequency" "DeliverabilityFrequency" NOT NULL,
    "time_of_day" TEXT NOT NULL,
    "weekday" INTEGER,
    "day_of_month" INTEGER,
    "interval_days" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "checks" TEXT[],
    "action_mode" "DeliverabilityActionMode" NOT NULL DEFAULT 'RECOMMEND',
    "warn_threshold" INTEGER NOT NULL DEFAULT 70,
    "critical_threshold" INTEGER NOT NULL DEFAULT 40,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverability_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deliverability_runs" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "schedule_uuid" TEXT NOT NULL,
    "status" "DeliverabilityRunStatus" NOT NULL DEFAULT 'RUNNING',
    "score" INTEGER,
    "risk_level" "DeliverabilityRiskLevel",
    "scored_by" TEXT,
    "jev_confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "mxtoolbox_check_uuid" TEXT,
    "mail_tester_test_uuid" TEXT,
    "recommended_daily_cap" INTEGER,
    "action_taken" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "deliverability_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "domain_sending_guards" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "schedule_uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "integration_account_uuid" TEXT NOT NULL,
    "integration_account_domain_uuid" TEXT,
    "daily_cap" INTEGER,
    "baseline_daily_volume" INTEGER,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "source_run_uuid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_sending_guards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deliverability_schedules_uuid_key" ON "deliverability_schedules"("uuid");
CREATE INDEX "deliverability_schedules_organisation_uuid_idx" ON "deliverability_schedules"("organisation_uuid");
CREATE UNIQUE INDEX "deliverability_runs_uuid_key" ON "deliverability_runs"("uuid");
CREATE INDEX "deliverability_runs_schedule_uuid_created_at_idx" ON "deliverability_runs"("schedule_uuid", "created_at");
CREATE UNIQUE INDEX "domain_sending_guards_uuid_key" ON "domain_sending_guards"("uuid");
CREATE UNIQUE INDEX "domain_sending_guards_schedule_uuid_key" ON "domain_sending_guards"("schedule_uuid");
CREATE INDEX "domain_sending_guards_integration_account_uuid_idx" ON "domain_sending_guards"("integration_account_uuid");

ALTER TABLE "deliverability_schedules" ADD CONSTRAINT "deliverability_schedules_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliverability_runs" ADD CONSTRAINT "deliverability_runs_schedule_uuid_fkey" FOREIGN KEY ("schedule_uuid") REFERENCES "deliverability_schedules"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "domain_sending_guards" ADD CONSTRAINT "domain_sending_guards_schedule_uuid_fkey" FOREIGN KEY ("schedule_uuid") REFERENCES "deliverability_schedules"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
