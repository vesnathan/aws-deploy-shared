/**
 * Seed Database Module
 *
 * Seeds DynamoDB table with data from a JSON file or data function.
 * Supports role assumption for cross-account or restricted access.
 */

import * as fs from "fs";
import * as path from "path";
import {
  DynamoDBClient,
  BatchWriteItemCommand,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Logger } from "../types";

export interface SeedDatabaseConfig {
  /** Enable database seeding */
  enabled: boolean;
  /**
   * Path to seed data file (JSON or JS/TS that exports default array)
   * Relative to projectRoot, e.g., "backend/data/seed-data.json"
   */
  dataFile?: string;
  /**
   * Or provide data directly via function
   * Function receives stage and should return array of items to seed
   */
  getData?: (stage: string) => Promise<SeedItem[]> | SeedItem[];
  /** Skip seeding if table already has data */
  skipIfNotEmpty?: boolean;
  /**
   * Only allow seeding on non-production stages (default: true)
   * Set to false to allow prod seeding (dangerous!)
   */
  devOnly?: boolean;
}

export interface SeedDatabaseParams {
  appName: string;
  stage: string;
  region: string;
  tableName: string;
  seedRoleArn?: string;
  projectRoot: string;
  logger: Logger;
}

export interface SeedItem {
  PK: string;
  SK: string;
  [key: string]: unknown;
}

/**
 * Seed database with data from file or function
 */
export async function seedDatabase(
  params: SeedDatabaseParams,
  config: SeedDatabaseConfig
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  const { appName, stage, region, tableName, seedRoleArn, projectRoot, logger } = params;

  // Block prod seeding by default
  const devOnly = config.devOnly !== false; // default true
  if (devOnly && stage === "prod") {
    logger.warning("\nSkipping database seeding on prod (devOnly: true)");
    return;
  }

  logger.info("\nSeeding database...");
  logger.info(`  Table: ${tableName}`);

  // Get seed data
  let seedData: SeedItem[];

  if (config.getData) {
    seedData = await config.getData(stage);
  } else if (config.dataFile) {
    const dataPath = path.resolve(projectRoot, config.dataFile);

    if (!fs.existsSync(dataPath)) {
      logger.warning(`  Seed data file not found: ${dataPath}`);
      return;
    }

    if (dataPath.endsWith(".json")) {
      const content = fs.readFileSync(dataPath, "utf-8");
      seedData = JSON.parse(content);
    } else {
      // Dynamic import for JS/TS files
      const module = await import(dataPath);
      seedData = module.default || module.seedData || module.data;
    }
  } else {
    logger.warning("  No seed data source configured (dataFile or getData)");
    return;
  }

  if (!Array.isArray(seedData) || seedData.length === 0) {
    logger.warning("  No seed data to insert");
    return;
  }

  logger.info(`  Items to seed: ${seedData.length}`);

  // Create DynamoDB client (with role assumption if needed)
  let dynamoClient: DynamoDBClient;

  if (seedRoleArn) {
    logger.info(`  Assuming role: ${seedRoleArn.substring(0, 50)}...`);

    const stsClient = new STSClient({ region });
    const assumeResponse = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: seedRoleArn,
        RoleSessionName: "seed-database",
        ExternalId: `${appName}-seed-${stage}`,
        DurationSeconds: 900,
      })
    );

    const credentials = assumeResponse.Credentials!;
    dynamoClient = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId: credentials.AccessKeyId!,
        secretAccessKey: credentials.SecretAccessKey!,
        sessionToken: credentials.SessionToken!,
      },
    });
  } else {
    dynamoClient = new DynamoDBClient({ region });
  }

  // Batch write items (DynamoDB limit: 25 items per batch)
  const BATCH_SIZE = 25;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < seedData.length; i += BATCH_SIZE) {
    const batch = seedData.slice(i, i + BATCH_SIZE);

    const writeRequests: WriteRequest[] = batch.map((item) => ({
      PutRequest: {
        Item: marshall(item, { removeUndefinedValues: true }),
      },
    }));

    try {
      await dynamoClient.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [tableName]: writeRequests,
          },
        })
      );
      successCount += batch.length;
    } catch (error: any) {
      logger.warning(`  Batch write failed: ${error.message}`);
      errorCount += batch.length;
    }
  }

  if (errorCount === 0) {
    logger.success(`  Seeded ${successCount} items successfully`);
  } else {
    logger.warning(`  Seeded ${successCount} items, ${errorCount} failed`);
  }
}
