-- CreateTable
CREATE TABLE "reminder_assignees" (
    "reminder_uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_assignees_pkey" PRIMARY KEY ("reminder_uuid","user_uuid")
);

-- CreateIndex
CREATE INDEX "reminder_assignees_user_uuid_idx" ON "reminder_assignees"("user_uuid");

-- AddForeignKey
ALTER TABLE "reminder_assignees" ADD CONSTRAINT "reminder_assignees_reminder_uuid_fkey" FOREIGN KEY ("reminder_uuid") REFERENCES "reminders"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_assignees" ADD CONSTRAINT "reminder_assignees_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
