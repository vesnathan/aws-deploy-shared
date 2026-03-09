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
    const expiresAt = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null;

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
              ${fieldPath}.provider = :provider,
              ${fieldPath}.subscriptionId = :subId,
              ${fieldPath}.customerId = :custId,
              ${fieldPath}.startedAt = if_not_exists(${fieldPath}.startedAt, :now),
              ${fieldPath}.expiresAt = :expiresAt,
              ${config.stripeGsiName}PK = :gsiPk,
              ${config.stripeGsiName}SK = :gsiSk,
              updatedAt = :now
        `,
        ExpressionAttributeNames: {
          "#st": "status",
        },
        ExpressionAttributeValues: {
          ":tier": tierId,
          ":status": status,
          ":provider": "stripe",
          ":subId": subscriptionId,
          ":custId": customerId,
          ":now": now,
          ":expiresAt": expiresAt,
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
          ":status": "cancelled",
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
          ":status": "past_due",
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
   * Get user's subscription info (for portal session creation)
   */
  async function getUserSubscription(
    userId: string,
  ): Promise<{ stripeCustomerId: string; stripeSubscriptionId: string } | null> {
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

      const customerId = current.customerId as string | undefined;
      const subscriptionId = current.subscriptionId as string | undefined;

      if (!customerId) {
        return null;
      }

      return {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId || "",
      };
    } catch (error) {
      console.error("Error getting user subscription:", error);
      return null;
    }
  }

  /**
   * Check test mode setting from DynamoDB
   */
  async function checkTestMode(
    testModeConfig?: { pk: string; sk: string; field: string },
  ): Promise<boolean> {
    if (!testModeConfig) {
      return false;
    }

    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: getTableName(),
          Key: { PK: testModeConfig.pk, SK: testModeConfig.sk },
        }),
      );

      return result.Item?.[testModeConfig.field] ?? false;
    } catch (error) {
      console.error("Failed to read test mode config, defaulting to production:", error);
      return false;
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
    checkTestMode,
  };
}

export type DynamoDBHelper = ReturnType<typeof createDynamoDBHelper>;
