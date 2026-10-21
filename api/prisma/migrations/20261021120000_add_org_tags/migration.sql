-- CreateEnum
CREATE TYPE "OrgTagEntityType" AS ENUM ('CONTACT_LIST', 'SEQUENCE', 'CAMPAIGN', 'FILTER');

-- CreateTable
CREATE TABLE "org_tags" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_tag_assignments" (
    "id" SERIAL NOT NULL,
    "tag_uuid" TEXT NOT NULL,
    "organisation_uuid" TEXT NOT NULL,
    "entity_type" "OrgTagEntityType" NOT NULL,
    "entity_uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_tags_uuid_key" ON "org_tags"("uuid");

-- CreateIndex
CREATE INDEX "org_tags_organisation_uuid_idx" ON "org_tags"("organisation_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "org_tags_organisation_uuid_name_key" ON "org_tags"("organisation_uuid", "name");

-- CreateIndex
CREATE INDEX "org_tag_assignments_organisation_uuid_entity_type_entity_uu_idx" ON "org_tag_assignments"("organisation_uuid", "entity_type", "entity_uuid");

-- CreateIndex
CREATE INDEX "org_tag_assignments_entity_type_entity_uuid_idx" ON "org_tag_assignments"("entity_type", "entity_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "org_tag_assignments_tag_uuid_entity_type_entity_uuid_key" ON "org_tag_assignments"("tag_uuid", "entity_type", "entity_uuid");

-- AddForeignKey
ALTER TABLE "org_tags" ADD CONSTRAINT "org_tags_organisation_uuid_fkey" FOREIGN KEY ("organisation_uuid") REFERENCES "organisations"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_tag_assignments" ADD CONSTRAINT "org_tag_assignments_tag_uuid_fkey" FOREIGN KEY ("tag_uuid") REFERENCES "org_tags"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
