/**
 * Factory for creating Stripe Customer Portal session Lambda handler
 */

import type { SubscriptionConfig } from "../types/config";
import { createSecretsManager } from "./utils/secrets";
import { createDynamoDBHelper } from "./utils/dynamodb";

/**
 * Portal session request from GraphQL
 */
export interface PortalSessionRequest {
  /** URL to redirect after portal session */
  returnUrl: string;
}

/**
 * Portal session response
 */
export interface PortalSessionResponse {
  /** URL to redirect user to Stripe portal */
  url: string;
}

/**
 * AppSync event shape
 */
interface AppSyncEvent {
  arguments: {
    input: PortalSessionRequest;
  };
  identity: {
    sub: string;
    username: string;
  };
}

/**
 * Factory function to create a portal session handler
 */
export function createPortalSessionHandler<
  TBenefits extends object,
  TProductMeta extends object = Record<string, unknown>,
>(config: SubscriptionConfig<TBenefits, TProductMeta>) {
  const secretsManager = createSecretsManager(config.region);
  const dynamoHelper = createDynamoDBHelper(config.region, config.dynamodb);

  // Cache for test mode (with TTL)
  let cachedTestMode: boolean | null = null;
  let testModeCacheTime = 0;
  const CACHE_TTL_MS = 60000; // 1 minute

  async function isTestMode(): Promise<boolean> {
    if (!config.testModeConfigKey) {
      return false;
    }

    const now = Date.now();
    if (cachedTestMode !== null && now - testModeCacheTime < CACHE_TTL_MS) {
      return cachedTestMode;
    }

    cachedTestMode = await dynamoHelper.checkTestMode(config.testModeConfigKey);
    testModeCacheTime = now;
    return cachedTestMode;
  }

  /**
   * Main handler function
   */
  return async function handler(event: AppSyncEvent): Promise<PortalSessionResponse> {
    const userId = event.identity?.sub;
    if (!userId) {
      throw new Error("Unauthorized: No user ID found");
    }

    const { returnUrl } = event.arguments.input;

    if (!returnUrl) {
      throw new Error("Return URL is required");
    }

    console.log(`Creating portal session for user ${userId}`);

    // Check test mode
    const testMode = await isTestMode();

    // Get Stripe secrets
    const secrets = await secretsManager.getStripeSecrets(
      config.stripeSecretsEnvVar,
      config.stripeTestSecretsEnvVar,
      testMode,
    );

    // Get user's Stripe customer ID
    const userSubscription = await dynamoHelper.getUserSubscription(userId);

    if (!userSubscription?.stripeCustomerId) {
      throw new Error("No subscription found. Please subscribe first.");
    }

    const stripeSecretKey = secrets.secretKey;
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    // Create Stripe Billing Portal session using fetch (no SDK dependency)
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: userSubscription.stripeCustomerId,
        return_url: returnUrl,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      console.error("Stripe API error:", error);
      throw new Error(`Failed to create portal session: ${error.error?.message || "Unknown error"}`);
    }

    const session = await response.json() as { url: string };

    console.log(`Portal session created for user ${userId}`);

    return {
      url: session.url,
    };
  };
}
