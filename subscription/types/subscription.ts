/**
 * Subscription status values
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
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
 */
export interface SubscriptionInfo extends SubscriptionInfoMinimal {
  /** Payment provider */
  provider: SubscriptionProvider | null;

  /** Provider's subscription ID */
  subscriptionId: string | null;

  /** Provider's customer ID */
  customerId: string | null;

  /** ISO timestamp when subscription started */
  startedAt: string | null;

  /** ISO timestamp when subscription expires (for cancelled) */
  expiresAt: string | null;

  /** ISO timestamp when cancelled */
  cancelledAt: string | null;
}

/**
 * Create default subscription info for a free tier
 */
export function createDefaultSubscriptionInfo(freeTierId: string): SubscriptionInfo {
  return {
    tier: freeTierId,
    status: null,
    provider: null,
    subscriptionId: null,
    customerId: null,
    startedAt: null,
    expiresAt: null,
    cancelledAt: null,
  };
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
 * Stripe subscription status mapping
 */
export const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "cancelled",
  unpaid: "cancelled",
  incomplete: null,
  incomplete_expired: null,
};
