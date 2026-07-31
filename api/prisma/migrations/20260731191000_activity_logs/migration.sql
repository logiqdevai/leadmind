-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "actor_user_uuid" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_uuid" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_logs_uuid_key" ON "activity_logs"("uuid");

-- CreateIndex
CREATE INDEX "activity_logs_organisation_uuid_created_at_idx" ON "activity_logs"("organisation_uuid", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_organisation_uuid_entity_type_idx" ON "activity_logs"("organisation_uuid", "entity_type");

-- CreateIndex
CREATE INDEX "activity_logs_organisation_uuid_action_idx" ON "activity_logs"("organisation_uuid", "action");

-- CreateIndex
CREATE INDEX "activity_logs_organisation_uuid_actor_user_uuid_idx" ON "activity_logs"("organisation_uuid", "actor_user_uuid");

-- CreateIndex
CREATE INDEX "activity_logs_entity_uuid_idx" ON "activity_logs"("entity_uuid");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_user_uuid_fkey" FOREIGN KEY ("actor_user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
