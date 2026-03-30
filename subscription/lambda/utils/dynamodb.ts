/**
 * DynamoDB utilities for subscription management
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBConfig } from "../../types/config";
import type { SubscriptionStatus } from "../../types/subscription";

/**
 * Create a DynamoDB helper for subscription operations
 */
export function createDynamoDBHelper(region: string, config: DynamoDBConfig) {
  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  function getTableName(): string {
    const tableName = process.env[config.tableNameEnvVar];
    if (!tableName) {
      throw new Error(`${config.tableNameEnvVar} environment variable not set`);
    }
    return tableName;
  }

  function formatUserPk(userId: string): string {
    return config.userPkFormat.replace("{userId}", userId);
  }

  function formatUserSk(userId: string): string {
    return config.userSkFormat.replace("{userId}", userId);
  }

  function formatStripeGsiPk(customerId: string): string {
    return config.stripeGsiPkFormat.replace("{customerId}", customerId);
  }

  /**
   * Find user by Stripe customer ID
   */
  async function findUserByStripeCustomerId(
    customerId: string,
  ): Promise<string | null> {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: getTableName(),
          IndexName: config.stripeGsiName,
          KeyConditionExpression: `${config.stripeGsiName}PK = :pk`,
          ExpressionAttributeValues: {
            ":pk": formatStripeGsiPk(customerId),
          },
          Limit: 1,
        }),
      );

      if (result.Items && result.Items.length > 0) {
        // Extract userId from PK (format: USER#userId)
        const pk = result.Items[0].PK as string;
        return pk.replace("USER#", "");
      }

      return null;
    } catch (error) {
      console.error("Error finding user by Stripe customer ID:", error);
      return null;
    }
  }

  /**
   * Update user subscription
   */
  async function updateUserSubscription(
    userId: string,
    tierId: string,
    status: SubscriptionStatus,
    customerId: string,
    subscriptionId: string,
    currentPeriodEnd?: number,
  ): Promise<void> {
    const now = new Date().toISOString();
    const periodEnd = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null;

    const fieldPath = config.subscriptionFieldPath;

    // Build the subscription object to set atomically
    // This avoids issues with nested path updates when parent doesn't exist
    // Field names match GraphQL conventions for direct type compatibility
    const subscriptionData = {
      tier: tierId,
      status: status,
      provider: "stripe",
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      createdAt: now, // Will be overwritten below if exists
      currentPeriodEnd: periodEnd,
    };

    // First, get existing subscription to preserve createdAt if it exists
    const existing = await getUserSubscription(userId);
    if (existing?.createdAt) {
      subscriptionData.createdAt = existing.createdAt;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: {
          PK: formatUserPk(userId),
          SK: formatUserSk(userId),
        },
        UpdateExpression: `
          SET ${fieldPath} = :subData,
              ${config.stripeGsiName}PK = :gsiPk,
              ${config.stripeGsiName}SK = :gsiSk,
              updatedAt = :now
        `,
        ExpressionAttributeValues: {
          ":subData": subscriptionData,
          ":now": now,
          ":gsiPk": formatStripeGsiPk(customerId),
          ":gsiSk": `SUB#${subscriptionId}`,
        },
      }),
    );

    console.log(
      `Updated subscription for user ${userId}: tier=${tierId}, status=${status}`,
    );
  }

  /**
   * Cancel user subscription (set tier to free)
   */
  async function cancelUserSubscription(
    userId: string,
    freeTierId: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const fieldPath = config.subscriptionFieldPath;

    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: {
          PK: formatUserPk(userId),
          SK: formatUserSk(userId),
        },
        UpdateExpression: `
          SET ${fieldPath}.tier = :tier,
              ${fieldPath}.#st = :status,
              ${fieldPath}.cancelledAt = :now,
              updatedAt = :now
        `,
        ExpressionAttributeNames: {
          "#st": "status",
        },
        ExpressionAttributeValues: {
          ":tier": freeTierId,
          ":status": "CANCELLED",
          ":now": now,
        },
      }),
    );

    console.log(`Subscription cancelled for user ${userId}`);
  }

  /**
   * Mark subscription as past due
   */
  async function markSubscriptionPastDue(userId: string): Promise<void> {
    const now = new Date().toISOString();
    const fieldPath = config.subscriptionFieldPath;

    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: {
          PK: formatUserPk(userId),
          SK: formatUserSk(userId),
        },
        UpdateExpression: `
          SET ${fieldPath}.#st = :status,
              updatedAt = :now
        `,
        ExpressionAttributeNames: {
          "#st": "status",
        },
        ExpressionAttributeValues: {
          ":status": "PAST_DUE",
          ":now": now,
        },
      }),
    );

    console.log(`Payment failed for user ${userId}, marked as past_due`);
  }

  /**
   * Log webhook event
   */
  async function logWebhookEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    status: "received" | "processed" | "error",
    ttlDays: number = 30,
    errorMessage?: string,
  ): Promise<void> {
    const now = new Date();
    const timestamp = now.toISOString();

    // Extract email from the payload if present
    const data = payload.data as { object?: Record<string, unknown> } | undefined;
    const obj = data?.object;
    const email =
      (obj?.customer_email as string) ||
      (obj?.customer_details as { email?: string })?.email ||
      (obj?.receipt_email as string);

    try {
      await docClient.send(
        new PutCommand({
          TableName: getTableName(),
          Item: {
            PK: "WEBHOOK_LOG",
            SK: `STRIPE#${timestamp}#${eventId}`,
            GSI1PK: "WEBHOOK_LOG#STRIPE",
            GSI1SK: timestamp,
            provider: "stripe",
            eventId,
            eventType,
            payload: JSON.stringify(payload),
            status,
            errorMessage,
            email,
            createdAt: timestamp,
            // TTL
            ttl: Math.floor(now.getTime() / 1000) + ttlDays * 24 * 60 * 60,
          },
        }),
      );
    } catch (error) {
      console.error("Failed to log webhook event:", error);
    }
  }

  /**
   * Get user's subscription info (for portal session creation and updates)
   */
  async function getUserSubscription(
    userId: string,
  ): Promise<{ stripeCustomerId: string; stripeSubscriptionId: string; createdAt?: string } | null> {
    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: getTableName(),
          Key: {
            PK: formatUserPk(userId),
            SK: formatUserSk(userId),
          },
        }),
      );

      if (!result.Item) {
        return null;
      }

      // Navigate to subscription field path
      const pathParts = config.subscriptionFieldPath.split(".");
      let current: Record<string, unknown> = result.Item as Record<string, unknown>;
      for (const part of pathParts) {
        if (current[part] === undefined) {
          return null;
        }
        current = current[part] as Record<string, unknown>;
      }

      const customerId = current.stripeCustomerId as string | undefined;
      const subscriptionId = current.stripeSubscriptionId as string | undefined;
      const createdAt = current.createdAt as string | undefined;

      if (!customerId) {
        return null;
      }

      return {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId || "",
        createdAt,
      };
    } catch (error) {
      console.error("Error getting user subscription:", error);
      return null;
    }
  }

  return {
    docClient,
    getTableName,
    formatUserPk,
    formatUserSk,
    formatStripeGsiPk,
    findUserByStripeCustomerId,
    getUserSubscription,
    updateUserSubscription,
    cancelUserSubscription,
    markSubscriptionPastDue,
    logWebhookEvent,
  };
}

export type DynamoDBHelper = ReturnType<typeof createDynamoDBHelper>;
