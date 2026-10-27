-- CreateEnum
CREATE TYPE "CallNoteStatus" AS ENUM ('NOT_AVAILABLE', 'NOT_INTERESTED', 'CALL_LATER', 'SEND_INFO', 'WRONG_NUMBER', 'DO_NOT_CALL', 'INTERESTED', 'MEETING_BOOKED', 'ALREADY_CUSTOMER', 'USING_COMPETITOR', 'NO_BUDGET', 'NOT_DECISION_MAKER', 'GATEKEEPER');

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN "call_note_status" "CallNoteStatus";

-- CreateIndex
CREATE INDEX "Interaction_type_call_note_status_idx" ON "Interaction"("type", "call_note_status");
