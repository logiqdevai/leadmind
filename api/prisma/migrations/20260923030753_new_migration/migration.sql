-- CreateEnum
CREATE TYPE "OAuthConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "oauth_models" (
    "id" SERIAL NOT NULL,
    "model_name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "grant_id" TEXT,
    "user_code" TEXT,
    "uid" TEXT,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_connections" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "granted_by_user_uuid" TEXT NOT NULL,
    "oauth_client_id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "client_name" TEXT,
    "client_uri" TEXT,
    "scope" TEXT NOT NULL,
    "status" "OAuthConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tool_invocation_logs" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT,
    "oauth_client_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "http_method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tool_invocation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_models_model_name_grant_id_idx" ON "oauth_models"("model_name", "grant_id");

-- CreateIndex
CREATE INDEX "oauth_models_model_name_user_code_idx" ON "oauth_models"("model_name", "user_code");

-- CreateIndex
CREATE INDEX "oauth_models_model_name_uid_idx" ON "oauth_models"("model_name", "uid");

-- CreateIndex
CREATE INDEX "oauth_models_expires_at_idx" ON "oauth_models"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_models_model_name_key_key" ON "oauth_models"("model_name", "key");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_connections_uuid_key" ON "oauth_connections"("uuid");

-- CreateIndex
CREATE INDEX "oauth_connections_organisation_uuid_idx" ON "oauth_connections"("organisation_uuid");

-- CreateIndex
CREATE INDEX "oauth_connections_oauth_client_id_idx" ON "oauth_connections"("oauth_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_connections_grant_id_key" ON "oauth_connections"("grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tool_invocation_logs_uuid_key" ON "mcp_tool_invocation_logs"("uuid");

-- CreateIndex
CREATE INDEX "mcp_tool_invocation_logs_organisation_uuid_created_at_idx" ON "mcp_tool_invocation_logs"("organisation_uuid", "created_at");

-- CreateIndex
CREATE INDEX "mcp_tool_invocation_logs_oauth_client_id_idx" ON "mcp_tool_invocation_logs"("oauth_client_id");

-- CreateIndex
CREATE INDEX "mcp_tool_invocation_logs_tool_name_idx" ON "mcp_tool_invocation_logs"("tool_name");

-- AddForeignKey
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_granted_by_user_uuid_fkey" FOREIGN KEY ("granted_by_user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_invocation_logs" ADD CONSTRAINT "mcp_tool_invocation_logs_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
