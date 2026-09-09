-- CreateTable
CREATE TABLE "sidebar_favorites" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "nav_key" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sidebar_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sidebar_favorites_uuid_key" ON "sidebar_favorites"("uuid");

-- CreateIndex
CREATE INDEX "sidebar_favorites_user_uuid_idx" ON "sidebar_favorites"("user_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sidebar_favorites_user_uuid_nav_key_key" ON "sidebar_favorites"("user_uuid", "nav_key");

-- AddForeignKey
ALTER TABLE "sidebar_favorites" ADD CONSTRAINT "sidebar_favorites_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
