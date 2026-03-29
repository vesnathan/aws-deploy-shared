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

  const webhookLogTtlDays = config.webhookLogTtlDays ?? 30;

  function isTestMode(): boolean {
    if (!config.stageEnvVar) {
      return false;
    }
    const stage = process.env[config.stageEnvVar];
    return stage !== "prod";
  }

  /**
   * Get tier from Stripe price ID
   */
  function getTierFromPriceId(priceId: string, secrets: Record<string, string | undefined>): string {
    // Log price ID mapping attempt
    console.log(`[getTierFromPriceId] Looking up priceId: ${priceId}`);

    // Log available price ID mappings from secrets
    const priceIdMappings: Record<string, string> = {};
    for (const tier of config.tiers) {
      if (tier.stripePriceIdKey) {
        priceIdMappings[tier.id] = `${tier.stripePriceIdKey} = ${secrets[tier.stripePriceIdKey] || "NOT_SET"}`;
      }
    }
    console.log(`[getTierFromPriceId] Available mappings:`, JSON.stringify(priceIdMappings));

    // Check all tiers to find matching price ID
    for (const tier of config.tiers) {
      if (tier.stripePriceIdKey && secrets[tier.stripePriceIdKey] === priceId) {
        console.log(`[getTierFromPriceId] MATCH: ${priceId} -> ${tier.id} (via ${tier.stripePriceIdKey})`);
        return tier.id;
      }
    }

    // Fallback: check price ID naming convention
    for (const tier of config.tiers) {
      if (priceId.toLowerCase().includes(tier.id.toLowerCase())) {
        console.log(`[getTierFromPriceId] FALLBACK MATCH: ${priceId} contains "${tier.id}" -> ${tier.id}`);
        return tier.id;
      }
    }

    console.warn(`[getTierFromPriceId] NO MATCH for priceId: ${priceId}, defaulting to first paid tier`);
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
    console.log(`[handleCheckoutCompleted] ====== START ======`);
    console.log(`[handleCheckoutCompleted] Session ID: ${session.id}`);
    console.log(`[handleCheckoutCompleted] Mode: ${session.mode}`);
    console.log(`[handleCheckoutCompleted] Customer: ${session.customer}`);
    console.log(`[handleCheckoutCompleted] Subscription: ${session.subscription}`);
    console.log(`[handleCheckoutCompleted] Metadata:`, JSON.stringify(session.metadata));

    const userId = session.metadata?.userId;
    if (!userId) {
      console.error("[handleCheckoutCompleted] No userId in checkout session metadata");
      return;
    }

    // Check if this is a product purchase
    if (session.mode === "payment" && session.metadata?.type === "product_purchase") {
      const productId = session.metadata?.productId;
      if (productId && config.hooks?.onProductPurchased) {
        await config.hooks.onProductPurchased(userId, productId, session.metadata);
      }
      console.log(`[handleCheckoutCompleted] Product purchase completed for user ${userId}, product ${productId}`);
      return;
    }

    // Handle subscription checkout
    const customerId = session.customer;
    const subscriptionId = session.subscription;

    if (!subscriptionId) {
      console.error("[handleCheckoutCompleted] No subscription ID in checkout session");
      return;
    }

    const tierId = session.metadata?.tierId ?? config.tiers.find((t) => t.level === 1)?.id;
    if (!tierId) {
      console.error("[handleCheckoutCompleted] Could not determine tier for subscription");
      return;
    }

    console.log(`[handleCheckoutCompleted] Creating subscription: userId=${userId}, tierId=${tierId}, customerId=${customerId}`);

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

    console.log(`[handleCheckoutCompleted] Checkout completed for user ${userId}, tier ${tierId}`);
    console.log(`[handleCheckoutCompleted] ====== END ======`);
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
    console.log(`[handleSubscriptionUpdated] ====== START ======`);
    console.log(`[handleSubscriptionUpdated] Subscription ID: ${subscription.id}`);
    console.log(`[handleSubscriptionUpdated] Customer ID: ${subscription.customer}`);
    console.log(`[handleSubscriptionUpdated] Status: ${subscription.status}`);
    console.log(`[handleSubscriptionUpdated] Items count: ${subscription.items?.data?.length ?? 0}`);

    // Log all items with their price IDs
    if (subscription.items?.data) {
      subscription.items.data.forEach((item, idx) => {
        console.log(`[handleSubscriptionUpdated] Item[${idx}]: priceId=${item.price?.id}, amount=${item.price?.unit_amount}, product=${item.price?.product}`);
      });
    }

    // Log schedule info if present
    if (subscription.schedule) {
      console.log(`[handleSubscriptionUpdated] HAS SCHEDULE: ${subscription.schedule} (changes may be pending)`);
    }

    // Log metadata
    if (subscription.metadata) {
      console.log(`[handleSubscriptionUpdated] Metadata:`, JSON.stringify(subscription.metadata));
    }

    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = STRIPE_STATUS_MAP[subscription.status] ?? null;
    console.log(`[handleSubscriptionUpdated] Mapped status: ${subscription.status} -> ${status}`);

    const priceId = subscription.items?.data?.[0]?.price?.id;
    console.log(`[handleSubscriptionUpdated] Using priceId: ${priceId}`);

    const tierId = priceId ? getTierFromPriceId(priceId, secrets) : config.freeTierId;
    console.log(`[handleSubscriptionUpdated] Resolved tierId: ${tierId}`);

    const userId = await dynamoHelper.findUserByStripeCustomerId(customerId);
    if (!userId) {
      console.error(`[handleSubscriptionUpdated] No user found for Stripe customer ${customerId}`);
      return;
    }
    console.log(`[handleSubscriptionUpdated] Found userId: ${userId}`);

    await dynamoHelper.updateUserSubscription(
      userId,
      tierId,
      status,
      customerId,
      subscriptionId,
      subscription.current_period_end,
    );

    console.log(`[handleSubscriptionUpdated] Updated subscription for user ${userId}: tier=${tierId}, status=${status}`);
    console.log(`[handleSubscriptionUpdated] ====== END ======`);
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

      // Check test mode (based on stage)
      const testMode = isTestMode();
      const stage = config.stageEnvVar ? process.env[config.stageEnvVar] : undefined;

      // Get secrets (pass stage for per-stack webhook secret support)
      const secrets = await secretsManager.getStripeSecrets(
        config.stripeAccountKeysEnvVar,
        config.stripeAppSecretsEnvVar,
        testMode,
        stage,
      );

      // Log loaded secrets (only price ID keys, not sensitive values)
      const priceIdKeys = Object.keys(secrets).filter(k => k.includes("PRICE_ID"));
      console.log(`[webhook] Loaded secrets with price ID keys: ${priceIdKeys.join(", ")}`);
      priceIdKeys.forEach(key => {
        console.log(`[webhook] ${key} = ${secrets[key]}`);
      });

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
