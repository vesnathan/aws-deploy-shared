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
