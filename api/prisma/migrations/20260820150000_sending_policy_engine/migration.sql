-- CreateEnum
CREATE TYPE "SendingPeriodUnit" AS ENUM ('HOUR', 'DAY', 'WEEK');

-- CreateEnum
CREATE TYPE "CampaignIntegrationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "SendingUsageScopeType" AS ENUM ('PROVIDER', 'INTEGRATION_ACCOUNT', 'CAMPAIGN_INTEGRATION');

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN     "campaign_integration_uuid" TEXT;

-- AlterTable
ALTER TABLE "sequence_enrollments" ADD COLUMN     "current_step_order_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "first_step_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "integration_accounts" ADD COLUMN     "max_messages_per_period" INTEGER,
ADD COLUMN     "max_messages_period_unit" "SendingPeriodUnit";

-- CreateTable
CREATE TABLE "sending_policies" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT true,
    "source_policy_uuid" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "window_start_minute" INTEGER,
    "window_end_minute" INTEGER,
    "min_interval_seconds" INTEGER NOT NULL DEFAULT 0,
    "min_interval_jitter_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sending_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sending_policy_stages" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "sending_policy_uuid" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "period_unit" "SendingPeriodUnit" NOT NULL,
    "duration_value" INTEGER,
    "duration_unit" "SendingPeriodUnit",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sending_policy_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_integrations" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "campaign_uuid" TEXT NOT NULL,
    "integration_account_uuid" TEXT NOT NULL,
    "sending_policy_uuid" TEXT NOT NULL,
    "status" "CampaignIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_integration_states" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "campaign_integration_uuid" TEXT NOT NULL,
    "policy_started_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "lifetime_sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_integration_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sending_usage_counters" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "scope_type" "SendingUsageScopeType" NOT NULL,
    "scope_uuid" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sending_usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sending_policies_uuid_key" ON "sending_policies"("uuid");

-- CreateIndex
CREATE INDEX "sending_policies_organisation_uuid_is_template_idx" ON "sending_policies"("organisation_uuid", "is_template");

-- CreateIndex
CREATE INDEX "sending_policies_source_policy_uuid_idx" ON "sending_policies"("source_policy_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sending_policy_stages_uuid_key" ON "sending_policy_stages"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sending_policy_stages_sending_policy_uuid_order_index_key" ON "sending_policy_stages"("sending_policy_uuid", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_integrations_uuid_key" ON "campaign_integrations"("uuid");

-- CreateIndex
CREATE INDEX "campaign_integrations_campaign_uuid_status_idx" ON "campaign_integrations"("campaign_uuid", "status");

-- CreateIndex
CREATE INDEX "campaign_integrations_integration_account_uuid_idx" ON "campaign_integrations"("integration_account_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_integrations_campaign_uuid_integration_account_uui_key" ON "campaign_integrations"("campaign_uuid", "integration_account_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_integration_states_uuid_key" ON "campaign_integration_states"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_integration_states_campaign_integration_uuid_key" ON "campaign_integration_states"("campaign_integration_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sending_usage_counters_uuid_key" ON "sending_usage_counters"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sending_usage_counters_scope_type_scope_uuid_period_key_key" ON "sending_usage_counters"("scope_type", "scope_uuid", "period_key");

-- CreateIndex
CREATE INDEX "OutreachMessage_campaign_integration_uuid_idx" ON "OutreachMessage"("campaign_integration_uuid");

-- CreateIndex
CREATE INDEX "OutreachMessage_status_scheduled_at_idx" ON "OutreachMessage"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_campaign_integration_uuid_fkey" FOREIGN KEY ("campaign_integration_uuid") REFERENCES "campaign_integrations"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sending_policies" ADD CONSTRAINT "sending_policies_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sending_policies" ADD CONSTRAINT "sending_policies_source_policy_uuid_fkey" FOREIGN KEY ("source_policy_uuid") REFERENCES "sending_policies"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sending_policy_stages" ADD CONSTRAINT "sending_policy_stages_sending_policy_uuid_fkey" FOREIGN KEY ("sending_policy_uuid") REFERENCES "sending_policies"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_integrations" ADD CONSTRAINT "campaign_integrations_campaign_uuid_fkey" FOREIGN KEY ("campaign_uuid") REFERENCES "marketing_campaigns"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_integrations" ADD CONSTRAINT "campaign_integrations_integration_account_uuid_fkey" FOREIGN KEY ("integration_account_uuid") REFERENCES "integration_accounts"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_integrations" ADD CONSTRAINT "campaign_integrations_sending_policy_uuid_fkey" FOREIGN KEY ("sending_policy_uuid") REFERENCES "sending_policies"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_integration_states" ADD CONSTRAINT "campaign_integration_states_campaign_integration_uuid_fkey" FOREIGN KEY ("campaign_integration_uuid") REFERENCES "campaign_integrations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

