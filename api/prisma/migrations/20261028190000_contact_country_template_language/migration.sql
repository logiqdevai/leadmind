-- Contacts get a country (ISO 3166-1 alpha-2) and message templates a language (ISO 639-1).
ALTER TABLE "Contact" ADD COLUMN "country" TEXT;

-- Every template (existing ones included) is Greek unless changed: the column default backfills current rows.
ALTER TABLE "message_templates" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'el';
