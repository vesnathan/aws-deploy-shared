/**
 * Factory for creating subscription hooks
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  SubscriptionConfig,
  TierDefinition,
  ProductDefinition,
} from "../../types/config";
import type { SubscriptionInfoMinimal, SubscriptionStatus } from "../../types/subscription";
import { isGiftExpired, getEffectiveStatus } from "../../types/subscription";

/**
 * Checkout URL options
 */
export interface CheckoutUrlOptions {
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Dependencies that must be provided by the project
 */
export interface SubscriptionHookDependencies<
  TBenefits extends Record<string, unknown>,
  TProductMeta extends Record<string, unknown>,
> {
  /** Hook to get current auth state */
  useAuth: () => {
    user: { userId: string } | null;
    isAuthenticated: boolean;
  };

  /** Function to fetch user profile with subscription info */
  fetchUserProfile: () => Promise<{
    subscription?: SubscriptionInfoMinimal & {
      giftedAt?: string | null;
      expiresAt?: string | null;
    };
  }>;

  /** Function to create checkout session */
  createCheckoutSession: (input: {
    type: "subscription" | "product";
    itemId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) => Promise<{ checkoutUrl: string; sessionId: string }>;

  /** Function to create billing portal session (optional - enables self-service management) */
  createPortalSession?: (input: {
    returnUrl: string;
  }) => Promise<{ url: string }>;

  /** Default URLs for subscription checkout (optional - defaults to /subscribe) */
  subscriptionUrls?: {
    success: string;
    cancel: string;
  };

  /** Default URLs for product checkout (optional - defaults to /purchase) */
  productUrls?: {
    success: string;
    cancel: string;
  };
}

/**
 * Return type for the subscription hook
 */
export interface UseSubscriptionReturn<TBenefits extends Record<string, unknown>> {
  // Tier info
  tier: TierDefinition<TBenefits>;
  tierId: string;
  tierName: string;
  tierLevel: number;
  tierColor: string;

  // Status
  status: SubscriptionStatus;
  /** Effective status (accounts for gift expiration) */
  effectiveStatus: SubscriptionStatus;
  isSubscribed: boolean;
  isActive: boolean;

  // Gifted subscription info
  /** Whether subscription is gifted */
  isGifted: boolean;
  /** Whether gifted subscription has expired */
  isGiftExpired: boolean;
  /** When gift was granted (ISO string) */
  giftedAt: string | null;
  /** When gift expires (ISO string) */
  giftExpiresAt: string | null;
  /** Remaining time on gift (formatted string, e.g. "3 months") */
  giftRemainingTime: string | null;

  // Benefits
  benefits: TBenefits;
  hasBenefit: <K extends keyof TBenefits>(benefit: K) => boolean;

  // Tier comparison
  isAtLeastTier: (requiredTierId: string) => boolean;

  // Actions
  refreshSubscription: () => Promise<void>;
  /** Create subscription checkout. Pass urlOptions to override default URLs. */
  createCheckout: (tierId: string, urlOptions?: CheckoutUrlOptions) => Promise<string | null>;
  /** Create product checkout. Pass urlOptions to override default URLs. */
  createProductCheckout: (
    productId: string,
    metadata?: Record<string, string>,
    urlOptions?: CheckoutUrlOptions,
  ) => Promise<string | null>;
  /** Open Stripe Billing Portal for self-service subscription management. Returns null if not configured. */
  openBillingPortal: (returnUrl?: string) => Promise<string | null>;
  /** Whether billing portal is available */
  hasBillingPortal: boolean;

  // Loading
  isLoading: boolean;
}

/**
 * Factory to create a subscription hook for a project
 */
export function createSubscriptionHook<
  TBenefits extends Record<string, unknown>,
  TProductMeta extends Record<string, unknown> = Record<string, unknown>,
>(
  config: SubscriptionConfig<TBenefits, TProductMeta>,
  dependencies: SubscriptionHookDependencies<TBenefits, TProductMeta>,
) {
  function getTier(tierId: string): TierDefinition<TBenefits> {
    return (
      config.tiers.find((t) => t.id === tierId) ||
      config.tiers.find((t) => t.id === config.freeTierId)!
    );
  }

  function getTierLevel(tierId: string): number {
    return getTier(tierId).level;
  }

  return function useSubscription(): UseSubscriptionReturn<TBenefits> {
    const { user, isAuthenticated } = dependencies.useAuth();
    const [tierId, setTierId] = useState<string>(config.freeTierId);
    const [status, setStatus] = useState<SubscriptionStatus>(null);
    const [giftedAt, setGiftedAt] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Derived values
    const tier = useMemo(() => getTier(tierId), [tierId]);
    const tierName = tier.displayName;
    const tierLevel = tier.level;
    const tierColor = tier.badgeColor || "#6B7280";
    const isSubscribed = tierId !== config.freeTierId;

    // Gifted subscription state
    const isGifted = status === "GIFTED";
    const giftExpired = isGifted && isGiftExpired(expiresAt);
    const effectiveStatus = getEffectiveStatus(status, expiresAt);

    // isActive should consider both regular subscriptions and non-expired gifts
    const isActive =
      isSubscribed &&
      (status === "ACTIVE" || (status === "GIFTED" && !giftExpired));

    const benefits = tier.benefits;

    // Calculate remaining time on gift
    const giftRemainingTime = useMemo(() => {
      if (!isGifted || !expiresAt || giftExpired) return null;
      const now = new Date();
      const expires = new Date(expiresAt);
      const diffMs = expires.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffMonths = Math.floor(diffDays / 30);

      if (diffMonths >= 1) {
        return `${diffMonths} month${diffMonths === 1 ? "" : "s"}`;
      }
      if (diffDays >= 1) {
        return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
      }
      return "less than a day";
    }, [isGifted, expiresAt, giftExpired]);

    // Benefit check
    const hasBenefit = useCallback(
      <K extends keyof TBenefits>(benefit: K): boolean => {
        return Boolean(benefits[benefit]);
      },
      [benefits],
    );

    // Tier comparison
    const isAtLeastTier = useCallback(
      (requiredTierId: string): boolean => {
        return tierLevel >= getTierLevel(requiredTierId);
      },
      [tierLevel],
    );

    // Refresh subscription from API
    const refreshSubscription = useCallback(async () => {
      if (!isAuthenticated || !user) {
        setTierId(config.freeTierId);
        setStatus(null);
        setGiftedAt(null);
        setExpiresAt(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const profile = await dependencies.fetchUserProfile();
        if (profile?.subscription) {
          setTierId(profile.subscription.tier || config.freeTierId);
          setStatus(profile.subscription.status);
          setGiftedAt(profile.subscription.giftedAt ?? null);
          setExpiresAt(profile.subscription.expiresAt ?? null);
        } else {
          setTierId(config.freeTierId);
          setStatus(null);
          setGiftedAt(null);
          setExpiresAt(null);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
        setTierId(config.freeTierId);
        setStatus(null);
        setGiftedAt(null);
        setExpiresAt(null);
      } finally {
        setIsLoading(false);
      }
    }, [isAuthenticated, user]);

    // Default URLs (can be configured in dependencies or overridden per-call)
    const defaultSubscriptionUrls = dependencies.subscriptionUrls ?? {
      success: `${window.location.origin}/subscribe?success=true`,
      cancel: `${window.location.origin}/subscribe?cancelled=true`,
    };
    const defaultProductUrls = dependencies.productUrls ?? {
      success: `${window.location.origin}/purchase?success=true`,
      cancel: `${window.location.origin}/purchase?cancelled=true`,
    };

    // Create subscription checkout
    const createCheckout = useCallback(
      async (checkoutTierId: string, urlOptions?: CheckoutUrlOptions): Promise<string | null> => {
        if (!isAuthenticated) {
          console.error("Must be authenticated to create checkout");
          return null;
        }

        try {
          const result = await dependencies.createCheckoutSession({
            type: "subscription",
            itemId: checkoutTierId,
            successUrl: urlOptions?.successUrl ?? defaultSubscriptionUrls.success,
            cancelUrl: urlOptions?.cancelUrl ?? defaultSubscriptionUrls.cancel,
          });
          return result?.checkoutUrl || null;
        } catch (error) {
          console.error("Failed to create checkout:", error);
          return null;
        }
      },
      [isAuthenticated, defaultSubscriptionUrls],
    );

    // Create product checkout
    const createProductCheckout = useCallback(
      async (
        productId: string,
        metadata?: Record<string, string>,
        urlOptions?: CheckoutUrlOptions,
      ): Promise<string | null> => {
        if (!isAuthenticated) {
          console.error("Must be authenticated to create checkout");
          return null;
        }

        try {
          const result = await dependencies.createCheckoutSession({
            type: "product",
            itemId: productId,
            successUrl: urlOptions?.successUrl ?? defaultProductUrls.success,
            cancelUrl: urlOptions?.cancelUrl ?? defaultProductUrls.cancel,
            metadata,
          });
          return result?.checkoutUrl || null;
        } catch (error) {
          console.error("Failed to create checkout:", error);
          return null;
        }
      },
      [isAuthenticated, defaultProductUrls],
    );

    // Check if billing portal is available
    const hasBillingPortal = Boolean(dependencies.createPortalSession);

    // Open billing portal
    const openBillingPortal = useCallback(
      async (returnUrl?: string): Promise<string | null> => {
        if (!isAuthenticated) {
          console.error("Must be authenticated to open billing portal");
          return null;
        }

        if (!dependencies.createPortalSession) {
          console.error("Billing portal not configured");
          return null;
        }

        if (!isSubscribed) {
          console.error("Must have an active subscription to manage billing");
          return null;
        }

        try {
          const result = await dependencies.createPortalSession({
            returnUrl: returnUrl ?? window.location.href,
          });
          return result?.url || null;
        } catch (error) {
          console.error("Failed to open billing portal:", error);
          return null;
        }
      },
      [isAuthenticated, isSubscribed],
    );

    // Initial fetch
    useEffect(() => {
      refreshSubscription();
    }, [refreshSubscription]);

    return {
      tier,
      tierId,
      tierName,
      tierLevel,
      tierColor,
      status,
      effectiveStatus,
      isSubscribed,
      isActive,
      isGifted,
      isGiftExpired: giftExpired,
      giftedAt,
      giftExpiresAt: expiresAt,
      giftRemainingTime,
      benefits,
      hasBenefit,
      isAtLeastTier,
      refreshSubscription,
      createCheckout,
      createProductCheckout,
      openBillingPortal,
      hasBillingPortal,
      isLoading,
    };
  };
}

/**
 * Helper to get all tiers from config
 */
export function getTiers<TBenefits extends Record<string, unknown>>(
  config: SubscriptionConfig<TBenefits>,
): TierDefinition<TBenefits>[] {
  return [...config.tiers].sort((a, b) => a.level - b.level);
}

/**
 * Helper to get all products from config
 */
export function getProducts<TProductMeta extends Record<string, unknown>>(
  config: SubscriptionConfig<Record<string, unknown>, TProductMeta>,
): ProductDefinition<TProductMeta>[] {
  return config.products ?? [];
}

/**
 * Format price for display
 */
export function formatPrice(priceInCents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(priceInCents / 100);
}
