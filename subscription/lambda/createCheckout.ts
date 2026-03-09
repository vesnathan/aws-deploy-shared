/**
 * Factory for creating Stripe checkout session Lambda handler
 */

import type { SubscriptionConfig, TierDefinition, ProductDefinition } from "../types/config";
import type { CreateCheckoutRequest, CreateCheckoutResponse } from "../types/checkout";
import { createSecretsManager } from "./utils/secrets";
import { createDynamoDBHelper } from "./utils/dynamodb";

/**
 * Factory function to create a checkout handler
 */
export function createCheckoutHandler<
  TBenefits extends object,
  TProductMeta extends object = Record<string, unknown>,
>(config: SubscriptionConfig<TBenefits, TProductMeta>) {
  const secretsManager = createSecretsManager(config.region);
  const dynamoHelper = createDynamoDBHelper(config.region, config.dynamodb);

  // Statement descriptor for bank statements (max 22 chars)
  const statementDescriptor = (config.statementDescriptor || config.projectName)
    .toUpperCase()
    .slice(0, 22);

  // Cache for test mode (with TTL)
  let cachedTestMode: boolean | null = null;
  let testModeCacheTime = 0;
  const CACHE_TTL_MS = 60000; // 1 minute

  function getTier(tierId: string): TierDefinition<TBenefits> | undefined {
    return config.tiers.find((t) => t.id === tierId);
  }

  function getProduct(productId: string): ProductDefinition<TProductMeta> | undefined {
    return config.products?.find((p) => p.id === productId);
  }

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
   * Create a Stripe checkout session for a subscription
   */
  async function createSubscriptionCheckout(
    request: CreateCheckoutRequest,
    secretKey: string,
    priceId: string,
  ): Promise<CreateCheckoutResponse> {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        "metadata[userId]": request.userId,
        "metadata[tierId]": request.itemId,
        "metadata[projectId]": config.projectId,
        "subscription_data[metadata][userId]": request.userId,
        "subscription_data[metadata][tierId]": request.itemId,
        "subscription_data[description]": config.projectName,
        // Statement descriptor shown on bank statements (e.g., "APP BUILDER STUDI* QUIZ NIGHT LIVE")
        "payment_intent_data[statement_descriptor_suffix]": statementDescriptor,
        allow_promotion_codes: "true",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Stripe API error:", error);
      throw new Error("Failed to create Stripe checkout session");
    }

    const session = (await response.json()) as { url: string; id: string };

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Create a Stripe checkout session for a one-time product purchase
   */
  async function createProductCheckout(
    request: CreateCheckoutRequest,
    secretKey: string,
    priceId: string,
  ): Promise<CreateCheckoutResponse> {
    // Build metadata params
    const metadataParams: Record<string, string> = {
      "metadata[userId]": request.userId,
      "metadata[productId]": request.itemId,
      "metadata[type]": "product_purchase",
      "metadata[projectId]": config.projectId,
    };

    // Add custom metadata
    if (request.metadata) {
      for (const [key, value] of Object.entries(request.metadata)) {
        metadataParams[`metadata[${key}]`] = value;
      }
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "payment",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        // Statement descriptor shown on bank statements (e.g., "APP BUILDER STUDI* QUIZ NIGHT LIVE")
        "payment_intent_data[statement_descriptor_suffix]": statementDescriptor,
        ...metadataParams,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Stripe API error:", error);
      throw new Error("Failed to create Stripe checkout session");
    }

    const session = (await response.json()) as { url: string; id: string };

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Main handler function
   */
  return async function handler(
    request: CreateCheckoutRequest,
  ): Promise<CreateCheckoutResponse> {
    console.log(`Creating checkout for ${config.projectId}:`, {
      userId: request.userId,
      type: request.type,
      itemId: request.itemId,
    });

    // Check test mode
    const testMode = await isTestMode();

    // Get secrets
    const secrets = await secretsManager.getStripeSecrets(
      config.stripeSecretsEnvVar,
      config.stripeTestSecretsEnvVar,
      testMode,
    );

    if (request.type === "subscription") {
      // Handle subscription checkout
      const tier = getTier(request.itemId);
      if (!tier) {
        throw new Error(`Invalid tier: ${request.itemId}`);
      }
      if (tier.priceInCents === 0) {
        throw new Error("Cannot checkout free tier");
      }

      const priceId = secrets[tier.stripePriceIdKey];
      if (!priceId) {
        throw new Error(`Price ID not configured for tier: ${request.itemId}`);
      }

      return createSubscriptionCheckout(request, secrets.secretKey, priceId);
    }

    if (request.type === "product") {
      // Handle one-time product checkout
      const product = getProduct(request.itemId);
      if (!product) {
        throw new Error(`Invalid product: ${request.itemId}`);
      }

      const priceId = secrets[product.stripePriceIdKey];
      if (!priceId) {
        throw new Error(`Price ID not configured for product: ${request.itemId}`);
      }

      return createProductCheckout(request, secrets.secretKey, priceId);
    }

    throw new Error(`Invalid checkout type: ${request.type}`);
  };
}
