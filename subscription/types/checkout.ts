/**
 * Checkout session types
 */

/**
 * Checkout type
 */
export type CheckoutType = "subscription" | "product";

/**
 * Create checkout request
 */
export interface CreateCheckoutRequest {
  /** User ID creating the checkout */
  userId: string;

  /** Type of checkout */
  type: CheckoutType;

  /** Tier ID (for subscription) or Product ID (for product) */
  itemId: string;

  /** URL to redirect on success */
  successUrl: string;

  /** URL to redirect on cancel */
  cancelUrl: string;

  /** Optional additional metadata */
  metadata?: Record<string, string>;
}

/**
 * Create checkout response
 */
export interface CreateCheckoutResponse {
  /** URL to redirect user to for checkout */
  checkoutUrl: string;

  /** Checkout session ID */
  sessionId: string;
}

/**
 * Stripe checkout session (minimal fields we use)
 */
export interface StripeCheckoutSession {
  id: string;
  customer: string;
  subscription?: string;
  mode: "subscription" | "payment";
  metadata?: Record<string, string>;
}

/**
 * Stripe subscription (minimal fields we use)
 */
export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  /** Subscription schedule ID (present if changes are scheduled for future) */
  schedule?: string | null;
  /** Subscription metadata */
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      price?: {
        id: string;
        /** Amount in cents */
        unit_amount?: number;
        /** Product ID */
        product?: string;
      };
    }>;
  };
}

/**
 * Stripe invoice (minimal fields we use)
 */
export interface StripeInvoice {
  id: string;
  customer: string;
  subscription?: string;
}

/**
 * Stripe event base
 */
export interface StripeEventBase {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}
