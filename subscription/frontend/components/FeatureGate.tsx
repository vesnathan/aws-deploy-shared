/**
 * Feature gating component
 */

import { ReactNode } from "react";
import type { TierDefinition } from "../../types/config";

/**
 * Props for FeatureGate component
 */
export interface FeatureGateProps<TBenefits extends Record<string, unknown>> {
  /** The benefit to check */
  benefit: keyof TBenefits;

  /** Function to check if user has benefit */
  hasBenefit: (benefit: keyof TBenefits) => boolean;

  /** Content to show when user has benefit */
  children: ReactNode;

  /** Optional content to show when user doesn't have benefit */
  fallback?: ReactNode;
}

/**
 * Factory to create a FeatureGate component for a project
 */
export function createFeatureGate<TBenefits extends Record<string, unknown>>() {
  return function FeatureGate({
    benefit,
    hasBenefit,
    children,
    fallback = null,
  }: FeatureGateProps<TBenefits>): ReactNode {
    if (hasBenefit(benefit)) {
      return children;
    }
    return fallback;
  };
}

/**
 * Props for TierGate component
 */
export interface TierGateProps {
  /** Required tier level (inclusive) */
  requiredTier: string;

  /** Function to check if user is at least the required tier */
  isAtLeastTier: (tierId: string) => boolean;

  /** Content to show when user meets tier requirement */
  children: ReactNode;

  /** Optional content to show when user doesn't meet requirement */
  fallback?: ReactNode;
}

/**
 * Component to gate content by tier level
 */
export function TierGate({
  requiredTier,
  isAtLeastTier,
  children,
  fallback = null,
}: TierGateProps): ReactNode {
  if (isAtLeastTier(requiredTier)) {
    return children;
  }
  return fallback;
}

/**
 * Props for SubscribedGate component
 */
export interface SubscribedGateProps {
  /** Whether user is subscribed (any paid tier) */
  isSubscribed: boolean;

  /** Content to show when user is subscribed */
  children: ReactNode;

  /** Optional content to show when user is not subscribed */
  fallback?: ReactNode;
}

/**
 * Component to gate content for subscribed users only
 */
export function SubscribedGate({
  isSubscribed,
  children,
  fallback = null,
}: SubscribedGateProps): ReactNode {
  if (isSubscribed) {
    return children;
  }
  return fallback;
}
