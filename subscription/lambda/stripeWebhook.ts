/**
 * Factory for creating Stripe webhook Lambda handler
 */

import type { SubscriptionConfig, TierDefinition } from "../types/config";
import type {
  StripeCheckoutSession,
  StripeSubscription,
  StripeInvoice,
  StripeEventBase,
} from "../types/checkout";
import { STRIPE_STATUS_MAP } from "../types/subscription";
import { createSecretsManager } from "./utils/secrets";
import { createDynamoDBHelper } from "./utils/dynamodb";
import { verifyStripeSignature } from "./utils/signature";

/**
 * API Gateway event shape
 */
interface APIGatewayEvent {
  headers: Record<string, string | undefined>;
  body: string;
  isBase64Encoded?: boolean;
}

/**
 * API Gateway response shape
 */
interface APIGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Factory function to create a Stripe webhook handler
 */
export function createStripeWebhookHandler<
  TBenefits extends object,
  TProductMeta extends object = Record<string, unknown>,
>(config: SubscriptionConfig<TBenefits, TProductMeta>) {
  const secretsManager = createSecretsManager(config.region);
  const dynamoHelper = createDynamoDBHelper(config.region, config.dynamodb);

  // Cache for test mode (with TTL)
  let cachedTestMode: boolean | null = null;
  let testModeCacheTime = 0;
  const CACHE_TTL_MS = 60000; // 1 minute

  const webhookLogTtlDays = config.webhookLogTtlDays ?? 30;

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
   * Get tier from Stripe price ID
   */
  function getTierFromPriceId(priceId: string, secrets: Record<string, string | undefined>): string {
    // Check all tiers to find matching price ID
    for (const tier of config.tiers) {
      if (tier.stripePriceIdKey && secrets[tier.stripePriceIdKey] === priceId) {
        return tier.id;
      }
    }

    // Fallback: check price ID naming convention
    for (const tier of config.tiers) {
      if (priceId.toLowerCase().includes(tier.id.toLowerCase())) {
        return tier.id;
      }
    }

    console.warn(`Unknown price ID: ${priceId}, defaulting to first paid tier`);
    const firstPaidTier = config.tiers.find((t) => t.priceInCents > 0);
    return firstPaidTier?.id ?? config.freeTierId;
  }

  /**
   * Handle checkout.session.completed event
   */
  async function handleCheckoutCompleted(
    session: StripeCheckoutSession,
    secrets: Record<string, string | undefined>,
  ): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error("No userId in checkout session metadata");
      return;
    }

    // Check if this is a product purchase
    if (session.mode === "payment" && session.metadata?.type === "product_purchase") {
      const productId = session.metadata?.productId;
      if (productId && config.hooks?.onProductPurchased) {
        await config.hooks.onProductPurchased(userId, productId, session.metadata);
      }
      console.log(`Product purchase completed for user ${userId}, product ${productId}`);
      return;
    }

    // Handle subscription checkout
    const customerId = session.customer;
    const subscriptionId = session.subscription;

    if (!subscriptionId) {
      console.error("No subscription ID in checkout session");
      return;
    }

    const tierId = session.metadata?.tierId ?? config.tiers.find((t) => t.level === 1)?.id;
    if (!tierId) {
      console.error("Could not determine tier for subscription");
      return;
    }

    await dynamoHelper.updateUserSubscription(
      userId,
      tierId,
      "active",
      customerId,
      subscriptionId,
    );

    // Call custom hook
    if (config.hooks?.onSubscriptionCreated) {
      await config.hooks.onSubscriptionCreated(userId, tierId, customerId, subscriptionId);
    }

    console.log(`Checkout completed for user ${userId}, tier ${tierId}`);
  }

  /**
   * Handle customer.subscription.created event
   */
  async function handleSubscriptionCreated(
    subscription: StripeSubscription,
    secrets: Record<string, string | undefined>,
  ): Promise<void> {
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = STRIPE_STATUS_MAP[subscription.status] ?? null;

    const priceId = subscription.items?.data?.[0]?.price?.id;
    const tierId = priceId ? getTierFromPriceId(priceId, secrets) : config.freeTierId;

    // Find user by customer ID
    const userId = await dynamoHelper.findUserByStripeCustomerId(customerId);
    if (!userId) {
      console.log(
        `No user found for Stripe customer ${customerId} - may be handled by checkout.session.completed`,
      );
      return;
    }

    await dynamoHelper.updateUserSubscription(
      userId,
      tierId,
      status,
      customerId,
      subscriptionId,
      subscription.current_period_end,
    );
  }

  /**
   * Handle customer.subscription.updated event
   */
  async function handleSubscriptionUpdated(
    subscription: StripeSubscription,
    secrets: Record<string, string | undefined>,
  ): Promise<void> {
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = STRIPE_STATUS_MAP[subscription.status] ?? null;

    const priceId = subscription.items?.data?.[0]?.price?.id;
    const tierId = priceId ? getTierFromPriceId(priceId, secrets) : config.freeTierId;

    const userId = await dynamoHelper.findUserByStripeCustomerId(customerId);
    if (!userId) {
      console.error(`No user found for Stripe customer ${customerId}`);
      return;
    }

    await dynamoHelper.updateUserSubscription(
      userId,
      tierId,
      status,
      customerId,
      subscriptionId,
      subscription.current_period_end,
    );

    console.log(`Subscription updated for user ${userId}: tier=${tierId}, status=${status}`);
  }

  /**
   * Handle customer.subscription.deleted event
   */
  async function handleSubscriptionDeleted(
    subscription: StripeSubscription,
  ): Promise<void> {
    const customerId = subscription.customer;

    const userId = await dynamoHelper.findUserByStripeCustomerId(customerId);
    if (!userId) {
      console.error(`No user found for Stripe customer ${customerId}`);
      return;
    }

    await dynamoHelper.cancelUserSubscription(userId, config.freeTierId);

    // Call custom hook
    if (config.hooks?.onSubscriptionCancelled) {
      await config.hooks.onSubscriptionCancelled(userId);
    }
  }

  /**
   * Handle invoice.payment_failed event
   */
  async function handlePaymentFailed(invoice: StripeInvoice): Promise<void> {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;

    if (!subscriptionId) {
      // Not a subscription payment
      return;
    }

    const userId = await dynamoHelper.findUserByStripeCustomerId(customerId);
    if (!userId) {
      console.error(`No user found for Stripe customer ${customerId}`);
      return;
    }

    await dynamoHelper.markSubscriptionPastDue(userId);

    // Call custom hook
    if (config.hooks?.onPaymentFailed) {
      await config.hooks.onPaymentFailed(userId);
    }
  }

  /**
   * Main handler function
   */
  return async function handler(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    console.log(`Stripe webhook received for ${config.projectId}`);

    const corsHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    try {
      // Get the signature from headers
      const signature =
        event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
      if (!signature) {
        console.error("Missing Stripe signature");
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing signature" }),
        };
      }

      // Check test mode
      const testMode = await isTestMode();

      // Get secrets
      const secrets = await secretsManager.getStripeSecrets(
        config.stripeSecretsEnvVar,
        config.stripeTestSecretsEnvVar,
        testMode,
      );

      // Get raw body
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body;

      // Verify signature
      if (!verifyStripeSignature(rawBody, signature, secrets.webhookSecret)) {
        console.error("Invalid Stripe signature");
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid signature" }),
        };
      }

      // Parse event
      const stripeEvent = JSON.parse(rawBody) as StripeEventBase;
      const eventType = stripeEvent.type;
      const eventId = stripeEvent.id;

      console.log(`Processing Stripe event: ${eventType} (${eventId})`);

      // Log webhook received
      await dynamoHelper.logWebhookEvent(
        eventId,
        eventType,
        stripeEvent as unknown as Record<string, unknown>,
        "received",
        webhookLogTtlDays,
      );

      try {
        // Handle different event types
        switch (eventType) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(
              stripeEvent.data.object as unknown as StripeCheckoutSession,
              secrets,
            );
            break;

          case "customer.subscription.created":
            await handleSubscriptionCreated(
              stripeEvent.data.object as unknown as StripeSubscription,
              secrets,
            );
            break;

          case "customer.subscription.updated":
            await handleSubscriptionUpdated(
              stripeEvent.data.object as unknown as StripeSubscription,
              secrets,
            );
            break;

          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(
              stripeEvent.data.object as unknown as StripeSubscription,
            );
            break;

          case "invoice.payment_failed":
            await handlePaymentFailed(
              stripeEvent.data.object as unknown as StripeInvoice,
            );
            break;

          default:
            console.log(`Unhandled event type: ${eventType}`);
        }

        // Log webhook processed successfully
        await dynamoHelper.logWebhookEvent(
          eventId,
          eventType,
          stripeEvent as unknown as Record<string, unknown>,
          "processed",
          webhookLogTtlDays,
        );
      } catch (processingError) {
        // Log webhook processing error
        const errorMessage =
          processingError instanceof Error
            ? processingError.message
            : "Unknown error";
        await dynamoHelper.logWebhookEvent(
          eventId,
          eventType,
          stripeEvent as unknown as Record<string, unknown>,
          "error",
          webhookLogTtlDays,
          errorMessage,
        );
        throw processingError;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ received: true }),
      };
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  };
}
