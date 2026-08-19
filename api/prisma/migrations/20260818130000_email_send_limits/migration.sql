-- CreateTable
CREATE TABLE "email_send_limits" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "provider" "ExternalIntegrationProvider" NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "max_count" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_send_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_send_limits_uuid_key" ON "email_send_limits"("uuid");

-- CreateIndex
CREATE INDEX "email_send_limits_organisation_uuid_idx" ON "email_send_limits"("organisation_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "email_send_limits_organisation_uuid_provider_period_key" ON "email_send_limits"("organisation_uuid", "provider", "period");

-- AddForeignKey
ALTER TABLE "email_send_limits" ADD CONSTRAINT "email_send_limits_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
