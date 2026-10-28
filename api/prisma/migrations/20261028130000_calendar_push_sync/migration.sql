-- Google Calendar incremental sync cursor and push-notification channel per connection.
ALTER TABLE "calendar_connections"
  ADD COLUMN "sync_token" TEXT,
  ADD COLUMN "watch_channel_id" TEXT,
  ADD COLUMN "watch_resource_id" TEXT,
  ADD COLUMN "watch_token" TEXT,
  ADD COLUMN "watch_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "calendar_connections_watch_channel_id_key" ON "calendar_connections"("watch_channel_id");
