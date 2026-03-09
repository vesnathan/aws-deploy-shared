/**
 * Stripe webhook signature verification
 */

import * as crypto from "crypto";

/**
 * Verify Stripe webhook signature
 *
 * @param payload - Raw request body
 * @param signature - Stripe-Signature header value
 * @param secret - Webhook secret from Stripe
 * @returns true if signature is valid
 */
export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  // Stripe signature format: t=timestamp,v1=signature
  const elements = signature.split(",");
  const timestampElement = elements.find((e) => e.startsWith("t="));
  const signatureElement = elements.find((e) => e.startsWith("v1="));

  if (!timestampElement || !signatureElement) {
    console.error("Invalid Stripe signature format");
    return false;
  }

  const timestamp = timestampElement.substring(2);
  const expectedSignature = signatureElement.substring(3);

  // Create signed payload
  const signedPayload = `${timestamp}.${payload}`;
  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(computedSignature),
    );
  } catch {
    return false;
  }
}

/**
 * Parse Stripe webhook timestamp
 *
 * @param signature - Stripe-Signature header value
 * @returns timestamp in seconds, or null if invalid
 */
export function parseStripeTimestamp(signature: string): number | null {
  const elements = signature.split(",");
  const timestampElement = elements.find((e) => e.startsWith("t="));

  if (!timestampElement) {
    return null;
  }

  const timestamp = parseInt(timestampElement.substring(2), 10);
  return isNaN(timestamp) ? null : timestamp;
}

/**
 * Check if webhook is within tolerance (default 5 minutes)
 */
export function isWebhookTimestampValid(
  signature: string,
  toleranceSeconds: number = 300,
): boolean {
  const timestamp = parseStripeTimestamp(signature);
  if (timestamp === null) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= toleranceSeconds;
}
