-- Track each visit to a booking link's public page.
ALTER TABLE "booking_links" ADD COLUMN "last_visited_at" TIMESTAMP(3);

CREATE TABLE "booking_link_visits" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "booking_link_uuid" TEXT NOT NULL,
    "user_agent" VARCHAR(512),
    "referrer" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_link_visits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_link_visits_uuid_key" ON "booking_link_visits"("uuid");
CREATE INDEX "booking_link_visits_booking_link_uuid_created_at_idx" ON "booking_link_visits"("booking_link_uuid", "created_at");

ALTER TABLE "booking_link_visits" ADD CONSTRAINT "booking_link_visits_booking_link_uuid_fkey" FOREIGN KEY ("booking_link_uuid") REFERENCES "booking_links"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
