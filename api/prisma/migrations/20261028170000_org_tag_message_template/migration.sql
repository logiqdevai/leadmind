-- Message templates can be grouped with the organisation-wide tags, like lists, sequences, campaigns and filters.
ALTER TYPE "OrgTagEntityType" ADD VALUE IF NOT EXISTS 'MESSAGE_TEMPLATE';
