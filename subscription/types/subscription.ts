/**
 * Subscription status values (uppercase to match GraphQL enum convention)
 */
export type SubscriptionStatus =
  | "ACTIVE"
  | "TRIAL"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED"
  | "GIFTED"
  | null;

/**
 * Subscription provider
 */
export type SubscriptionProvider = "stripe";

/**
 * Minimal subscription info needed for hooks/UI
 */
export interface SubscriptionInfoMinimal {
  /** Current tier ID */
  tier: string;

  /** Subscription status */
  status: SubscriptionStatus;
}

/**
 * Full subscription info stored on user profile
 * Field names match GraphQL conventions for direct type compatibility
 */
export interface SubscriptionInfo extends SubscriptionInfoMinimal {
  /** Payment provider */
  provider: SubscriptionProvider | null;

  /** Stripe subscription ID */
  stripeSubscriptionId: string | null;

  /** Stripe customer ID */
  stripeCustomerId: string | null;

  /** ISO timestamp when subscription was created */
  createdAt: string | null;

  /** ISO timestamp when current billing period ends */
  currentPeriodEnd: string | null;

  /** ISO timestamp when cancelled */
  cancelledAt: string | null;

  /** ISO timestamp when gifted (for GIFTED status) */
  giftedAt: string | null;

  /** ISO timestamp when gifted subscription expires */
  expiresAt: string | null;
}

/**
 * Create default subscription info for a free tier
 */
export function createDefaultSubscriptionInfo(freeTierId: string): SubscriptionInfo {
  return {
    tier: freeTierId,
    status: null,
    provider: null,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    createdAt: null,
    currentPeriodEnd: null,
    cancelledAt: null,
    giftedAt: null,
    expiresAt: null,
  };
}

/**
 * Gifted subscription term in months
 */
export type GiftedSubscriptionTerm = 3 | 6 | 12;

/**
 * Create a gifted subscription info
 */
export function createGiftedSubscriptionInfo(
  tierId: string,
  termMonths: GiftedSubscriptionTerm = 6
): SubscriptionInfo {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + termMonths);

  return {
    tier: tierId,
    status: "GIFTED",
    provider: null,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    createdAt: now.toISOString(),
    currentPeriodEnd: null,
    cancelledAt: null,
    giftedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Check if a gifted subscription has expired
 */
export function isGiftExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/**
 * Get the effective subscription status, accounting for gift expiration
 */
export function getEffectiveStatus(
  status: SubscriptionStatus,
  expiresAt?: string | null
): SubscriptionStatus {
  if (status === "GIFTED" && isGiftExpired(expiresAt)) {
    return "EXPIRED";
  }
  return status;
}

/**
 * Stripe webhook event types we handle
 */
export type StripeWebhookEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_succeeded"
  | "invoice.payment_failed";

/**
 * Stripe subscription status mapping (to uppercase GraphQL enum values)
 */
export const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  trialing: "TRIAL",
  past_due: "PAST_DUE",
  canceled: "CANCELLED",
  unpaid: "CANCELLED",
  incomplete: null,
  incomplete_expired: null,
};
