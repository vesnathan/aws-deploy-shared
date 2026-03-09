/**
 * Frontend exports
 */

export {
  createSubscriptionHook,
  getTiers,
  getProducts,
  formatPrice,
  type SubscriptionHookDependencies,
  type UseSubscriptionReturn,
  type CheckoutUrlOptions,
} from "./hooks/useSubscription";

export {
  createFeatureGate,
  TierGate,
  SubscribedGate,
  type FeatureGateProps,
  type TierGateProps,
  type SubscribedGateProps,
} from "./components/FeatureGate";
