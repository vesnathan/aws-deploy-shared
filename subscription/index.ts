/**
 * Shared Subscription System
 *
 * A unified subscription system for AWS projects using Stripe.
 *
 * @example
 * ```typescript
 * // 1. Define your subscription config
 * import { defineSubscriptionConfig } from "@aws-deploy-shared/subscription";
 *
 * interface MyBenefits {
 *   adFree: boolean;
 *   premiumFeatures: boolean;
 * }
 *
 * export const subscriptionConfig = defineSubscriptionConfig<MyBenefits>({
 *   projectId: "my-app",
 *   projectName: "My App",
 *   region: "ap-southeast-2",
 *   freeTierId: "FREE",
 *   tiers: [
 *     { id: "FREE", level: 0, priceInCents: 0, ... },
 *     { id: "PRO", level: 1, priceInCents: 1000, ... },
 *   ],
 *   dynamodb: { ... },
 *   stripeSecretsEnvVar: "STRIPE_SECRETS_ARN",
 * });
 *
 * // 2. Create Lambda handlers
 * import { createCheckoutHandler, createStripeWebhookHandler } from "@aws-deploy-shared/subscription/lambda";
 *
 * export const handler = createCheckoutHandler(subscriptionConfig);
 *
 * // 3. Create frontend hook
 * import { createSubscriptionHook } from "@aws-deploy-shared/subscription/frontend";
 *
 * export const useSubscription = createSubscriptionHook(subscriptionConfig, {
 *   useAuth: () => useMyAuthHook(),
 *   fetchUserProfile: () => fetchMyProfile(),
 *   createCheckoutSession: (input) => createCheckout(input),
 * });
 * ```
 */

// Types
export * from "./types";

// Config
export { defineSubscriptionConfig } from "./types/config";

// Re-export for convenience
export type { SubscriptionConfig, TierDefinition, ProductDefinition, GiftedConfig } from "./types/config";
export type { SubscriptionInfo, SubscriptionStatus, SubscriptionProvider, GiftedSubscriptionTerm } from "./types/subscription";

// Gifted subscription utilities
export {
  createGiftedSubscriptionInfo,
  isGiftExpired,
  getEffectiveStatus,
  createDefaultSubscriptionInfo,
} from "./types/subscription";

// Note: validateSubscriptionConfig (Zod validation) is available via:
// import { validateSubscriptionConfig } from "@aws-deploy-shared/subscription/config";
