CREATE TYPE "OrganisationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "OrganisationInviteRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "OrganisationInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "organisations" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organisations_uuid_key" ON "organisations"("uuid");
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");
CREATE INDEX "organisations_uuid_idx" ON "organisations"("uuid");
CREATE INDEX "organisations_slug_idx" ON "organisations"("slug");

CREATE TABLE "organisation_members" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "role" "OrganisationRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organisation_members_uuid_key" ON "organisation_members"("uuid");
CREATE UNIQUE INDEX "organisation_members_organisation_uuid_user_uuid_key" ON "organisation_members"("organisation_uuid", "user_uuid");
CREATE INDEX "organisation_members_organisation_uuid_idx" ON "organisation_members"("organisation_uuid");
CREATE INDEX "organisation_members_user_uuid_idx" ON "organisation_members"("user_uuid");

CREATE TABLE "organisation_invitations" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganisationInviteRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "OrganisationInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_user_uuid" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organisation_invitations_uuid_key" ON "organisation_invitations"("uuid");
CREATE UNIQUE INDEX "organisation_invitations_token_key" ON "organisation_invitations"("token");
CREATE INDEX "organisation_invitations_organisation_uuid_idx" ON "organisation_invitations"("organisation_uuid");
CREATE INDEX "organisation_invitations_email_idx" ON "organisation_invitations"("email");
CREATE INDEX "organisation_invitations_token_idx" ON "organisation_invitations"("token");
CREATE INDEX "organisation_invitations_status_idx" ON "organisation_invitations"("status");

INSERT INTO "organisations" ("uuid", "name", "slug", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    COALESCE(split_part(u.email, '@', 1), 'user') || '''s workspace',
    lower(regexp_replace(COALESCE(split_part(u.email, '@', 1), 'user'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(u.uuid, 1, 8),
    NOW(),
    NOW()
FROM "users" u;

INSERT INTO "organisation_members" ("uuid", "organisation_uuid", "user_uuid", "role", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    o.uuid,
    u.uuid,
    'OWNER'::"OrganisationRole",
    NOW(),
    NOW()
FROM "users" u
JOIN "organisations" o ON o.slug = lower(regexp_replace(COALESCE(split_part(u.email, '@', 1), 'user'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(u.uuid, 1, 8);

CREATE TEMP TABLE user_org_map AS
SELECT om.user_uuid, om.organisation_uuid
FROM "organisation_members" om;

ALTER TABLE "Filter" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "scoring_instructions" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "Contact" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "contact_lists" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "Interaction" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "OutreachMessage" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "OutreachSequence" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "sender_profiles" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "message_templates" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "marketing_campaigns" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "openai_batch_jobs" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "integrations" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "reminders" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "forms" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "contact_audience_analyses" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "ai_usage_logs" ADD COLUMN "organisation_uuid" TEXT;
ALTER TABLE "apify_usage_logs" ADD COLUMN "organisation_uuid" TEXT;

UPDATE "Filter" f SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE f."user_uuid" = m.user_uuid;
UPDATE "scoring_instructions" s SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE s."user_uuid" = m.user_uuid;
UPDATE "Contact" c SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE c."user_uuid" = m.user_uuid;
UPDATE "contact_lists" cl SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE cl."user_uuid" = m.user_uuid;
UPDATE "Interaction" i SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE i."user_uuid" = m.user_uuid;
UPDATE "OutreachMessage" om SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE om."user_uuid" = m.user_uuid;
UPDATE "OutreachSequence" os SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE os."user_uuid" = m.user_uuid;
UPDATE "sender_profiles" sp SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE sp."user_uuid" = m.user_uuid;
UPDATE "message_templates" mt SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE mt."user_uuid" = m.user_uuid;
UPDATE "marketing_campaigns" mc SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE mc."user_uuid" = m.user_uuid;
UPDATE "openai_batch_jobs" oj SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE oj."user_uuid" = m.user_uuid;
UPDATE "integrations" ig SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE ig."user_uuid" = m.user_uuid;
UPDATE "reminders" r SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE r."user_uuid" = m.user_uuid;
UPDATE "forms" f SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE f."user_uuid" = m.user_uuid;
UPDATE "contact_audience_analyses" ca SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE ca."user_uuid" = m.user_uuid;
UPDATE "ai_usage_logs" al SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE al."user_uuid" = m.user_uuid;
UPDATE "apify_usage_logs" apl SET "organisation_uuid" = m.organisation_uuid FROM user_org_map m WHERE apl."user_uuid" = m.user_uuid;

ALTER TABLE "Filter" DROP CONSTRAINT IF EXISTS "Filter_user_uuid_fkey";
ALTER TABLE "scoring_instructions" DROP CONSTRAINT IF EXISTS "scoring_instructions_user_uuid_fkey";
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_user_uuid_fkey";
ALTER TABLE "contact_lists" DROP CONSTRAINT IF EXISTS "contact_lists_user_uuid_fkey";
ALTER TABLE "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_user_uuid_fkey";
ALTER TABLE "OutreachMessage" DROP CONSTRAINT IF EXISTS "OutreachMessage_user_uuid_fkey";
ALTER TABLE "OutreachSequence" DROP CONSTRAINT IF EXISTS "OutreachSequence_user_uuid_fkey";
ALTER TABLE "sender_profiles" DROP CONSTRAINT IF EXISTS "sender_profiles_user_uuid_fkey";
ALTER TABLE "message_templates" DROP CONSTRAINT IF EXISTS "message_templates_user_uuid_fkey";
ALTER TABLE "marketing_campaigns" DROP CONSTRAINT IF EXISTS "marketing_campaigns_user_uuid_fkey";
ALTER TABLE "openai_batch_jobs" DROP CONSTRAINT IF EXISTS "openai_batch_jobs_user_uuid_fkey";
ALTER TABLE "integrations" DROP CONSTRAINT IF EXISTS "integrations_user_uuid_fkey";
ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_user_uuid_fkey";
ALTER TABLE "forms" DROP CONSTRAINT IF EXISTS "forms_user_uuid_fkey";
ALTER TABLE "contact_audience_analyses" DROP CONSTRAINT IF EXISTS "contact_audience_analyses_user_uuid_fkey";
ALTER TABLE "ai_usage_logs" DROP CONSTRAINT IF EXISTS "ai_usage_logs_user_uuid_fkey";
ALTER TABLE "apify_usage_logs" DROP CONSTRAINT IF EXISTS "apify_usage_logs_user_uuid_fkey";

DROP INDEX IF EXISTS "Contact_user_uuid_lead_uuid_key";
DROP INDEX IF EXISTS "Contact_user_uuid_idx";
DROP INDEX IF EXISTS "Filter_user_uuid_idx";
DROP INDEX IF EXISTS "Interaction_user_uuid_idx";
DROP INDEX IF EXISTS "OutreachMessage_user_uuid_idx";
DROP INDEX IF EXISTS "OutreachSequence_user_uuid_idx";
DROP INDEX IF EXISTS "integrations_user_uuid_provider_key";
DROP INDEX IF EXISTS "integrations_user_uuid_idx";
DROP INDEX IF EXISTS "scoring_instructions_user_uuid_idx";
DROP INDEX IF EXISTS "contact_lists_user_uuid_idx";
DROP INDEX IF EXISTS "sender_profiles_user_uuid_idx";
DROP INDEX IF EXISTS "message_templates_user_uuid_idx";
DROP INDEX IF EXISTS "marketing_campaigns_user_uuid_idx";
DROP INDEX IF EXISTS "reminders_user_uuid_idx";
DROP INDEX IF EXISTS "reminders_user_uuid_status_idx";
DROP INDEX IF EXISTS "reminders_user_uuid_remind_at_idx";
DROP INDEX IF EXISTS "forms_user_uuid_idx";
DROP INDEX IF EXISTS "contact_audience_analyses_user_uuid_idx";
DROP INDEX IF EXISTS "ai_usage_logs_user_uuid_created_at_idx";
DROP INDEX IF EXISTS "ai_usage_logs_user_uuid_provider_idx";
DROP INDEX IF EXISTS "apify_usage_logs_user_uuid_created_at_idx";
DROP INDEX IF EXISTS "apify_usage_logs_user_uuid_operation_idx";
DROP INDEX IF EXISTS "apify_usage_logs_user_uuid_actor_id_idx";

ALTER TABLE "Filter" DROP COLUMN "user_uuid";
ALTER TABLE "scoring_instructions" DROP COLUMN "user_uuid";
ALTER TABLE "Contact" DROP COLUMN "user_uuid";
ALTER TABLE "contact_lists" DROP COLUMN "user_uuid";
ALTER TABLE "Interaction" DROP COLUMN "user_uuid";
ALTER TABLE "OutreachMessage" DROP COLUMN "user_uuid";
ALTER TABLE "OutreachSequence" DROP COLUMN "user_uuid";
ALTER TABLE "sender_profiles" DROP COLUMN "user_uuid";
ALTER TABLE "message_templates" DROP COLUMN "user_uuid";
ALTER TABLE "marketing_campaigns" DROP COLUMN "user_uuid";
ALTER TABLE "openai_batch_jobs" DROP COLUMN "user_uuid";
ALTER TABLE "integrations" DROP COLUMN "user_uuid";
ALTER TABLE "reminders" DROP COLUMN "user_uuid";
ALTER TABLE "forms" DROP COLUMN "user_uuid";
ALTER TABLE "contact_audience_analyses" DROP COLUMN "user_uuid";
ALTER TABLE "ai_usage_logs" DROP COLUMN "user_uuid";
ALTER TABLE "apify_usage_logs" DROP COLUMN "user_uuid";

ALTER TABLE "Filter" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "scoring_instructions" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "contact_lists" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "Interaction" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "OutreachMessage" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "OutreachSequence" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "sender_profiles" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "message_templates" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "marketing_campaigns" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "openai_batch_jobs" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "integrations" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "reminders" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "forms" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "contact_audience_analyses" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "ai_usage_logs" ALTER COLUMN "organisation_uuid" SET NOT NULL;
ALTER TABLE "apify_usage_logs" ALTER COLUMN "organisation_uuid" SET NOT NULL;

CREATE UNIQUE INDEX "Contact_organisation_uuid_lead_uuid_key" ON "Contact"("organisation_uuid", "lead_uuid");
CREATE UNIQUE INDEX "integrations_organisation_uuid_provider_key" ON "integrations"("organisation_uuid", "provider");

CREATE INDEX "Filter_organisation_uuid_idx" ON "Filter"("organisation_uuid");
CREATE INDEX "scoring_instructions_organisation_uuid_idx" ON "scoring_instructions"("organisation_uuid");
CREATE INDEX "Contact_organisation_uuid_idx" ON "Contact"("organisation_uuid");
CREATE INDEX "contact_lists_organisation_uuid_idx" ON "contact_lists"("organisation_uuid");
CREATE INDEX "Interaction_organisation_uuid_idx" ON "Interaction"("organisation_uuid");
CREATE INDEX "OutreachMessage_organisation_uuid_idx" ON "OutreachMessage"("organisation_uuid");
CREATE INDEX "OutreachSequence_organisation_uuid_idx" ON "OutreachSequence"("organisation_uuid");
CREATE INDEX "sender_profiles_organisation_uuid_idx" ON "sender_profiles"("organisation_uuid");
CREATE INDEX "message_templates_organisation_uuid_idx" ON "message_templates"("organisation_uuid");
CREATE INDEX "marketing_campaigns_organisation_uuid_idx" ON "marketing_campaigns"("organisation_uuid");
CREATE INDEX "integrations_organisation_uuid_idx" ON "integrations"("organisation_uuid");
CREATE INDEX "reminders_organisation_uuid_idx" ON "reminders"("organisation_uuid");
CREATE INDEX "reminders_organisation_uuid_status_idx" ON "reminders"("organisation_uuid", "status");
CREATE INDEX "reminders_organisation_uuid_remind_at_idx" ON "reminders"("organisation_uuid", "remind_at");
CREATE INDEX "forms_organisation_uuid_idx" ON "forms"("organisation_uuid");
CREATE INDEX "contact_audience_analyses_organisation_uuid_idx" ON "contact_audience_analyses"("organisation_uuid");
CREATE INDEX "ai_usage_logs_organisation_uuid_created_at_idx" ON "ai_usage_logs"("organisation_uuid", "created_at");
CREATE INDEX "ai_usage_logs_organisation_uuid_provider_idx" ON "ai_usage_logs"("organisation_uuid", "provider");
CREATE INDEX "apify_usage_logs_organisation_uuid_created_at_idx" ON "apify_usage_logs"("organisation_uuid", "created_at");
CREATE INDEX "apify_usage_logs_organisation_uuid_operation_idx" ON "apify_usage_logs"("organisation_uuid", "operation");
CREATE INDEX "apify_usage_logs_organisation_uuid_actor_id_idx" ON "apify_usage_logs"("organisation_uuid", "actor_id");

ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_invited_by_user_uuid_fkey" FOREIGN KEY ("invited_by_user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Filter" ADD CONSTRAINT "Filter_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scoring_instructions" ADD CONSTRAINT "scoring_instructions_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sender_profiles" ADD CONSTRAINT "sender_profiles_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "openai_batch_jobs" ADD CONSTRAINT "openai_batch_jobs_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forms" ADD CONSTRAINT "forms_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_audience_analyses" ADD CONSTRAINT "contact_audience_analyses_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "apify_usage_logs" ADD CONSTRAINT "apify_usage_logs_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
