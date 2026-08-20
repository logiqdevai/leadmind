import * as crypto from 'crypto';

/**
 * Header Scrapio sends the HMAC signature in. Not documented in Scrapio's OpenAPI spec —
 * confirm against a real delivery (or their dashboard docs) and adjust if it differs.
 */
export const SCRAPIO_SIGNATURE_HEADER = 'x-scrapio-signature';

/**
 * Verify a Scrapio webhook delivery. Scrapio signs with HMAC-SHA256(secret, rawBody),
 * hex-encoded, per their `CreateWebhookEndpointDto.secret` description ("used to HMAC-sign
 * outgoing payloads so you can verify they came from us"). Confirmed against a real delivery:
 * the header value is prefixed with `sha256=`, e.g. `sha256=<hexdigest>` — strip it before
 * comparing, or every signature fails the length check regardless of the secret.
 */
export function verifyScrapioSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const receivedHex = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedHex),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}
