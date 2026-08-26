-- Destination mailbox that receives a forwarded copy of each captured reply,
-- independent of reply_to_email (which is the Resend-side inbound capture address and
-- must stay unique/verified). This one is just a plain notification target, so no
-- uniqueness constraint.
ALTER TABLE "organisations" ADD COLUMN "reply_forward_email" TEXT;
