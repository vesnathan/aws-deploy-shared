/**
 * Subscription Configuration Types
 *
 * Each project defines its configuration with this schema.
 * The shared system uses these types to generate types, validate data,
 * and configure Lambda handlers.
 */

/** Currency for pricing (ISO 4217) */
export type Currency = "USD" | "AUD" | "EUR" | "GBP";

/** Billing interval */
export type BillingInterval = "month" | "year" | "one_time";

/**
 * A single subscription tier definition
 */
export interface TierDefinition<TBenefits extends object> {
  /** Unique tier identifier (used in code) */
  id: string;

  /** Display name for UI */
  displayName: string;

  /** Tier level for comparison (0 = free, higher = better) */
  level: number;

  /** Price in cents (0 for free tier) */
  priceInCents: number;

  /** Billing interval */
  interval: BillingInterval;

  /** Currency */
  currency: Currency;

  /** Stripe Price ID key (from Secrets Manager) */
  stripePriceIdKey: string;

  /** Badge color (hex) */
  badgeColor?: string;

  /** Project-specific benefits */
  benefits: TBenefits;
}

/**
 * One-time purchase product definition
 */
export interface ProductDefinition<
  TMetadata extends object = Record<string, unknown>,
> {
  /** Unique product identifier */
  id: string;

  /** Display name */
  displayName: string;

  /** Price in cents */
  priceInCents: number;

  /** Currency */
  currency: Currency;

  /** Stripe Price ID key (from Secrets Manager) */
  stripePriceIdKey: string;

  /** Optional: Mark as popular */
  popular?: boolean;

  /** Project-specific metadata */
  metadata?: TMetadata;
}

/**
 * Webhook handler customization hooks
 */
export interface WebhookHooks {
  /** Called after checkout.session.completed (subscription) */
  onSubscriptionCreated?: (
    userId: string,
    tierId: string,
    customerId: string,
    subscriptionId: string,
  ) => Promise<void>;

  /** Called after checkout.session.completed (one-time purchase) */
  onProductPurchased?: (
    userId: string,
    productId: string,
    metadata: Record<string, string>,
  ) => Promise<void>;

  /** Called after subscription cancellation */
  onSubscriptionCancelled?: (userId: string) => Promise<void>;

  /** Called after subscription updated (tier change) */
  onSubscriptionUpdated?: (
    userId: string,
    oldTierId: string,
    newTierId: string,
  ) => Promise<void>;

  /** Called when payment fails */
  onPaymentFailed?: (userId: string) => Promise<void>;
}

/**
 * DynamoDB schema configuration
 */
export interface DynamoDBConfig {
  /** Table name environment variable key */
  tableNameEnvVar: string;

  /** User item PK format (e.g., "USER#{userId}") */
  userPkFormat: string;

  /** User item SK format (e.g., "PROFILE" or "USER#{userId}") */
  userSkFormat: string;

  /** Field path for subscription info (e.g., "subscription" or "subscriptionInfo") */
  subscriptionFieldPath: string;

  /** GSI name for Stripe customer lookup */
  stripeGsiName: string;

  /** GSI PK format (e.g., "STRIPE#{customerId}") */
  stripeGsiPkFormat: string;
}

/**
 * Complete subscription configuration for a project
 */
export interface SubscriptionConfig<
  TBenefits extends object,
  TProductMeta extends object = Record<string, unknown>,
> {
  /** Project identifier (used in logging, resource naming) */
  projectId: string;

  /** Project display name */
  projectName: string;

  /**
   * Statement descriptor shown on customer's bank/card statement.
   * Max 22 characters. Will appear as "APP BUILDER STUDI* {descriptor}".
   * If not set, uses projectName (truncated to 22 chars).
   * Example: "QUIZ NIGHT LIVE" or "CARD TRAINER"
   */
  statementDescriptor?: string;

  /** AWS region */
  region: string;

  /** Free tier ID (the tier users get when not subscribed) */
  freeTierId: string;

  /** All tier definitions */
  tiers: TierDefinition<TBenefits>[];

  /** One-time purchase products (optional) */
  products?: ProductDefinition<TProductMeta>[];

  /** DynamoDB configuration */
  dynamodb: DynamoDBConfig;

  /**
   * Env var for Stripe account-level keys ARN (shared across all apps).
   * Contains: STRIPE_LIVE_SECRET_KEY, STRIPE_TEST_SECRET_KEY, etc.
   */
  stripeAccountKeysEnvVar: string;

  /**
   * Env var for app-specific Stripe secrets ARN.
   * Contains: STRIPE_LIVE_WEBHOOK_SECRET, STRIPE_LIVE_*_PRICE_ID, etc.
   */
  stripeAppSecretsEnvVar: string;

  /**
   * Stage environment variable name for determining live/test mode.
   * When stage !== 'prod', test mode is enabled (uses STRIPE_TEST_* keys).
   * Example: 'STAGE' - will check process.env.STAGE
   */
  stageEnvVar: string;

  /** Optional: Webhook logging TTL in days (default: 30) */
  webhookLogTtlDays?: number;

  /** Optional: Custom webhook hooks */
  hooks?: WebhookHooks;
}

/**
 * Helper function to define a subscription config with type inference
 */
export function defineSubscriptionConfig<
  TBenefits extends object,
  TProductMeta extends object = Record<string, unknown>,
>(
  config: SubscriptionConfig<TBenefits, TProductMeta>,
): SubscriptionConfig<TBenefits, TProductMeta> {
  return config;
}

/**
 * Extract tier IDs from a config as a union type
 */
export type TierIds<T extends SubscriptionConfig<object>> =
  T["tiers"][number]["id"];

/**
 * Extract product IDs from a config as a union type
 */
export type ProductIds<T extends SubscriptionConfig<object>> =
  NonNullable<T["products"]>[number]["id"];
