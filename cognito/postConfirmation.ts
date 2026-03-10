/**
 * Shared Post-Confirmation Lambda Factory
 *
 * Creates user profile on signup with:
 * - Base: userId, email, displayName, timestamps, GSIs
 * - Subscription: Welcome trial (configurable duration)
 * - Onboarding: State tracking for all apps
 *
 * App-specific data (stats, chips, etc.) should be initialized
 * lazily by resolvers when first needed.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  PostConfirmationTriggerEvent,
  PostConfirmationTriggerHandler,
} from "aws-lambda";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Post-Confirmation configuration
 */
export interface PostConfirmationConfig {
  /** Table name env var (default: "TABLE_NAME") */
  tableNameEnvVar?: string;

  /** Welcome trial configuration */
  welcomeTrial?: {
    /** Trial duration in days. Use null for perpetual (never expires) */
    durationDays: number | null;
    /** Trial tier level (default: 1) */
    tierLevel: number;
    /** Display name for gift source */
    giftedByName: string;
  };

  /** Auth methods this app supports */
  authMethods?: {
    native?: boolean;  // Email/password
    oauth?: boolean;   // Google OAuth
  };
}

/**
 * Get display name from Cognito attributes
 */
function getDisplayName(attributes: Record<string, string>): string {
  return (
    attributes.preferred_username ||
    attributes.name ||
    attributes.given_name ||
    attributes.email?.split("@")[0] ||
    "User"
  );
}

/**
 * Check if display name exists
 */
async function displayNameExists(
  tableName: string,
  displayName: string
): Promise<boolean> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `DISPLAYNAME#${displayName.toLowerCase()}`,
      },
      Limit: 1,
    })
  );
  return (result.Items?.length ?? 0) > 0;
}

/**
 * Generate unique display name
 */
async function makeDisplayNameUnique(
  tableName: string,
  baseName: string
): Promise<string> {
  if (!(await displayNameExists(tableName, baseName))) {
    return baseName;
  }

  for (let i = 0; i < 10; i++) {
    const candidate = `${baseName}${Math.floor(Math.random() * 1000)}`;
    if (!(await displayNameExists(tableName, candidate))) {
      return candidate;
    }
  }

  return `User${Date.now() % 100000}`;
}

/**
 * Create welcome subscription object
 */
function createWelcomeSubscription(
  now: string,
  config: NonNullable<PostConfirmationConfig["welcomeTrial"]>
) {
  // null durationDays = perpetual (never expires)
  const expiresAt =
    config.durationDays === null
      ? null
      : new Date(
          Date.parse(now) + config.durationDays * 24 * 60 * 60 * 1000
        ).toISOString();

  return {
    tier: config.tierLevel,
    status: config.durationDays === null ? "gifted" : "trialing",
    provider: null,
    subscriptionId: null,
    customerId: null,
    startedAt: now,
    expiresAt,
    cancelledAt: null,
    // Gift tracking
    giftedBy: "system",
    giftedByName: config.giftedByName,
    giftedAt: now,
    giftExpiresAt: expiresAt,
    giftNotificationSeen: false,
  };
}

/**
 * Create onboarding state object
 */
function createOnboardingState(
  _authMethods: PostConfirmationConfig["authMethods"],
  isOAuthUser: boolean
) {
  return {
    onboardingComplete: false,
    onboardingStep: null as string | null,
    // Track auth method used
    authMethod: isOAuthUser ? "oauth" : "native",
    // Email verification (OAuth is pre-verified)
    emailVerified: isOAuthUser,
  };
}

/**
 * Create the Post-Confirmation handler
 */
export function createPostConfirmationHandler(
  config: PostConfirmationConfig = {}
): PostConfirmationTriggerHandler {
  const tableNameEnvVar = config.tableNameEnvVar ?? "TABLE_NAME";

  return async (event: PostConfirmationTriggerEvent) => {
    console.log("PostConfirmation:", JSON.stringify(event, null, 2));

    const tableName = process.env[tableNameEnvVar];
    if (!tableName) {
      console.error(`${tableNameEnvVar} not set`);
      return event;
    }

    const userId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;
    const attributes = event.request.userAttributes as Record<string, string>;
    const now = new Date().toISOString();

    // Detect if OAuth user (username starts with provider prefix)
    const username = event.userName || "";
    const isOAuthUser = username.toLowerCase().startsWith("google_");

    // Check if already exists
    try {
      const existing = await docClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: `USER#${userId}`, SK: "PROFILE" },
        })
      );
      if (existing.Item) {
        console.log(`Profile exists for ${userId}, skipping`);
        return event;
      }
    } catch (e) {
      console.error("Error checking profile:", e);
    }

    try {
      // Get unique display name
      const baseName = getDisplayName(attributes);
      const displayName = await makeDisplayNameUnique(tableName, baseName);

      // Build profile
      const profile: Record<string, unknown> = {
        // Base fields
        PK: `USER#${userId}`,
        SK: "PROFILE",
        EntityType: "USER",
        userId,
        email,
        displayName,
        CreatedAt: now,
        UpdatedAt: now,

        // GSI1: List users by date
        GSI1PK: "USER",
        GSI1SK: `${now}#${userId}`,

        // GSI2: Display name uniqueness
        GSI2PK: `DISPLAYNAME#${displayName.toLowerCase()}`,
        GSI2SK: "USER",

        // Onboarding state
        ...createOnboardingState(config.authMethods, isOAuthUser),
      };

      // Add welcome subscription if configured
      if (config.welcomeTrial) {
        profile.subscription = createWelcomeSubscription(now, config.welcomeTrial);
      } else {
        // Default: no subscription (free tier)
        profile.subscription = {
          tier: 0,
          status: "none",
          provider: null,
          subscriptionId: null,
          customerId: null,
          startedAt: null,
          expiresAt: null,
          cancelledAt: null,
        };
      }

      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: profile,
          ConditionExpression: "attribute_not_exists(PK)",
        })
      );

      console.log(`Created profile: ${userId} (${displayName})`);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ConditionalCheckFailedException"
      ) {
        console.log(`Profile exists (race): ${userId}`);
      } else {
        console.error("Error creating profile:", error);
      }
    }

    return event;
  };
}
