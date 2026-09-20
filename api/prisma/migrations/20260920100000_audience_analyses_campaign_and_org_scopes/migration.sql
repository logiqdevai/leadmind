-- Audience analyses can now cover a campaign or the whole CRM, not just a filter or list.
ALTER TYPE "ContactAudienceAnalysisScope" ADD VALUE IF NOT EXISTS 'CAMPAIGN';
ALTER TYPE "ContactAudienceAnalysisScope" ADD VALUE IF NOT EXISTS 'ORGANISATION';

ALTER TABLE "contact_audience_analyses" ADD COLUMN "campaign_uuid" TEXT;

CREATE INDEX "contact_audience_analyses_campaign_uuid_idx" ON "contact_audience_analyses"("campaign_uuid");

ALTER TABLE "contact_audience_analyses" ADD CONSTRAINT "contact_audience_analyses_campaign_uuid_fkey" FOREIGN KEY ("campaign_uuid") REFERENCES "marketing_campaigns"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
