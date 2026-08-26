-- reply_to_email becomes the org-scoped resolution key for inbound Resend
-- "email.received" webhooks (matched against the recipient "to" address), instead of an
-- unscoped Contact.email lookup that could cross-match contacts in different organisations.
CREATE UNIQUE INDEX "organisations_reply_to_email_key" ON "organisations"("reply_to_email");

-- Interaction.outreach_message_uuid was 1:1 with OutreachMessage, forcing every
-- lifecycle event after the initial "send" interaction to leave this FK null. Relax it to
-- 1:many so every event -- including every individual reply in a back-and-forth thread --
-- links back to its message instead of only the latest reply overwriting
-- OutreachMessage.reply_subject/text/html.
ALTER TABLE "Interaction" DROP CONSTRAINT "Interaction_outreach_message_uuid_fkey";
DROP INDEX "Interaction_outreach_message_uuid_key";
CREATE INDEX "Interaction_outreach_message_uuid_idx" ON "Interaction"("outreach_message_uuid");
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_outreach_message_uuid_fkey" FOREIGN KEY ("outreach_message_uuid") REFERENCES "OutreachMessage"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
