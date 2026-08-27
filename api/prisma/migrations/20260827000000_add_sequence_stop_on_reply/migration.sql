-- Lets a sequence keep sending its remaining steps after a contact replies,
-- instead of always auto-cancelling the enrollment. Defaults to true (stop),
-- matching the existing expectation that a reply ends the sequence.
ALTER TABLE "OutreachSequence" ADD COLUMN "stop_on_reply" BOOLEAN NOT NULL DEFAULT true;
