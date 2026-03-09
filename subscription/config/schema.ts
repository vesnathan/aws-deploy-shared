/**
 * Zod schemas for validating subscription configuration
 */

import { z } from "zod";

/** Currency schema */
export const CurrencySchema = z.enum(["USD", "AUD", "EUR", "GBP"]);

/** Billing interval schema */
export const BillingIntervalSchema = z.enum(["month", "year", "one_time"]);

/** Tier definition schema */
export const TierDefinitionSchema = z.object({
  id: z.string().min(1, "Tier ID is required"),
  displayName: z.string().min(1, "Display name is required"),
  level: z.number().int().min(0, "Level must be 0 or higher"),
  priceInCents: z.number().int().min(0, "Price must be 0 or higher"),
  interval: BillingIntervalSchema,
  currency: CurrencySchema,
  stripePriceIdKey: z.string(),
  badgeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Badge color must be a hex color").optional(),
  benefits: z.record(z.unknown()),
});

/** Product definition schema */
export const ProductDefinitionSchema = z.object({
  id: z.string().min(1, "Product ID is required"),
  displayName: z.string().min(1, "Display name is required"),
  priceInCents: z.number().int().positive("Price must be positive"),
  currency: CurrencySchema,
  stripePriceIdKey: z.string().min(1, "Stripe price ID key is required"),
  popular: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** DynamoDB config schema */
export const DynamoDBConfigSchema = z.object({
  tableNameEnvVar: z.string().min(1, "Table name env var is required"),
  userPkFormat: z.string().includes("{userId}", {
    message: "User PK format must include {userId} placeholder",
  }),
  userSkFormat: z.string().min(1, "User SK format is required"),
  subscriptionFieldPath: z.string().min(1, "Subscription field path is required"),
  stripeGsiName: z.string().min(1, "Stripe GSI name is required"),
  stripeGsiPkFormat: z.string().includes("{customerId}", {
    message: "Stripe GSI PK format must include {customerId} placeholder",
  }),
});

/** Test mode config schema */
export const TestModeConfigSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  field: z.string().min(1),
});

/** Full subscription config schema */
export const SubscriptionConfigSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  projectName: z.string().min(1, "Project name is required"),
  region: z.string().min(1, "Region is required"),
  freeTierId: z.string().min(1, "Free tier ID is required"),
  tiers: z.array(TierDefinitionSchema).min(1, "At least one tier is required"),
  products: z.array(ProductDefinitionSchema).optional(),
  dynamodb: DynamoDBConfigSchema,
  stripeSecretsEnvVar: z.string().min(1, "Stripe secrets env var is required"),
  stripeTestSecretsEnvVar: z.string().optional(),
  testModeConfigKey: TestModeConfigSchema.optional(),
  webhookLogTtlDays: z.number().int().positive().optional(),
  hooks: z.object({
    onSubscriptionCreated: z.function().optional(),
    onProductPurchased: z.function().optional(),
    onSubscriptionCancelled: z.function().optional(),
    onSubscriptionUpdated: z.function().optional(),
    onPaymentFailed: z.function().optional(),
  }).optional(),
});

/**
 * Validate a subscription config
 */
export function validateSubscriptionConfig(config: unknown): void {
  const result = SubscriptionConfigSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid subscription config:\n${errors}`);
  }

  // Additional validation: freeTierId must exist in tiers
  const tierIds = result.data.tiers.map((t) => t.id);
  if (!tierIds.includes(result.data.freeTierId)) {
    throw new Error(`Free tier ID "${result.data.freeTierId}" not found in tiers`);
  }

  // Validate tier levels are unique
  const levels = result.data.tiers.map((t) => t.level);
  const uniqueLevels = new Set(levels);
  if (uniqueLevels.size !== levels.length) {
    throw new Error("Tier levels must be unique");
  }

  // Validate free tier has level 0 and price 0
  const freeTier = result.data.tiers.find((t) => t.id === result.data.freeTierId);
  if (freeTier && freeTier.priceInCents !== 0) {
    throw new Error("Free tier must have price of 0");
  }
}

export type ValidatedSubscriptionConfig = z.infer<typeof SubscriptionConfigSchema>;
