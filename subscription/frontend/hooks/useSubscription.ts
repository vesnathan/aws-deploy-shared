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
    subscription?: SubscriptionInfoMinimal;
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
  isSubscribed: boolean;
  isActive: boolean;

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
    const [isLoading, setIsLoading] = useState(true);

    // Derived values
    const tier = useMemo(() => getTier(tierId), [tierId]);
    const tierName = tier.displayName;
    const tierLevel = tier.level;
    const tierColor = tier.badgeColor || "#6B7280";
    const isSubscribed = tierId !== config.freeTierId;
    const isActive = isSubscribed && status === "active";
    const benefits = tier.benefits;

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
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const profile = await dependencies.fetchUserProfile();
        if (profile?.subscription) {
          setTierId(profile.subscription.tier || config.freeTierId);
          setStatus(profile.subscription.status);
        } else {
          setTierId(config.freeTierId);
          setStatus(null);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
        setTierId(config.freeTierId);
        setStatus(null);
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
      isSubscribed,
      isActive,
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
