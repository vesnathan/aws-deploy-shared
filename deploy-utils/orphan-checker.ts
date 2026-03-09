/**
 * Orphan Checker
 *
 * ⚠️ CRITICAL: Used by ALL projects! Test changes across all integrated projects.
 *
 * Detects and optionally deletes orphaned AWS resources that may have been
 * left behind from failed deployments or incomplete stack deletions.
 *
 * ## Why This Exists
 *
 * When CloudFormation deployments fail mid-way, some resources may be created
 * but not tracked by CloudFormation. On retry, CloudFormation tries to CREATE
 * these resources again, but they already exist → deployment fails.
 *
 * Most common example: CloudWatch Log Groups for Lambda functions.
 * CloudFormation creates the log group, Lambda creation fails, stack rolls back,
 * but the log group remains. Next deployment: "Log group already exists".
 *
 * ## How It Works
 *
 * 1. Lists all resources matching the app-stage pattern
 * 2. Compares against resources managed by CloudFormation
 * 3. Resources that exist but aren't in CloudFormation = orphans
 * 4. Auto-deletes safe orphans (log groups)
 * 5. Warns about orphans needing manual cleanup (S3 buckets, Cognito pools)
 *
 * ## Required IAM Permissions
 *
 * The orphan checker needs broader permissions than the deploy user.
 * Create a dedicated IAM user with:
 * - logs:DescribeLogGroups, logs:DeleteLogGroup
 * - s3:ListAllMyBuckets
 * - cognito-idp:ListUserPools
 * - cloudformation:ListStacks, cloudformation:DescribeStackResources
 *
 * Set credentials in .env as ORPHAN_CHECKER_KEY and ORPHAN_CHECKER_SECRET.
 *
 * ## Usage
 *
 * Run via deploy menu: Option 1 "Check Orphans"
 * Run via CLI: `yarn deploy --stage prod --action orphans`
 *
 * Always run this BEFORE retrying a failed deployment!
 *
 * @see /home/liqk1ugzoezh5okwywlr_/dev/shared/deploy-utils/README.md
 */

import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  CloudFormationClient,
  ListStacksCommand,
  DescribeStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

interface OrphanCheckerConfig {
  appName: string;
  stage: string;
  region: string;
  logger: {
    info: (msg: string) => void;
    success: (msg: string) => void;
    warning: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Get AWS client config with orphan-checker credentials if available
 */
function getClientConfig(region: string) {
  const accessKeyId = process.env.ORPHAN_CHECKER_KEY;
  const secretAccessKey = process.env.ORPHAN_CHECKER_SECRET;

  if (accessKeyId && secretAccessKey) {
    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };
  }

  // Fall back to default credentials
  return { region };
}

export interface OrphanedResource {
  type: "log-group" | "s3-bucket" | "cognito-pool";
  name: string;
  reason: string;
}

export class OrphanChecker {
  private config: OrphanCheckerConfig;
  private cloudwatchClient: CloudWatchLogsClient;
  private cfnClient: CloudFormationClient;
  private cognitoClient: CognitoIdentityProviderClient;
  private s3Client: S3Client;

  constructor(config: OrphanCheckerConfig) {
    this.config = config;
    const clientConfig = getClientConfig(config.region);
    this.cloudwatchClient = new CloudWatchLogsClient(clientConfig);
    this.cfnClient = new CloudFormationClient(clientConfig);
    this.cognitoClient = new CognitoIdentityProviderClient(clientConfig);
    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Get all log groups managed by CloudFormation for this stack
   */
  private async getManagedLogGroups(stackName: string): Promise<Set<string>> {
    const managedLogGroups = new Set<string>();

    try {
      // Check if stack exists
      const stacksResponse = await this.cfnClient.send(
        new ListStacksCommand({
          StackStatusFilter: [
            "CREATE_COMPLETE",
            "UPDATE_COMPLETE",
            "UPDATE_ROLLBACK_COMPLETE",
            "CREATE_IN_PROGRESS",
            "UPDATE_IN_PROGRESS",
          ],
        })
      );

      const stackExists = stacksResponse.StackSummaries?.some(
        (s) => s.StackName === stackName
      );

      if (!stackExists) {
        return managedLogGroups;
      }

      // Get all resources in the stack
      const resourcesResponse = await this.cfnClient.send(
        new DescribeStackResourcesCommand({ StackName: stackName })
      );

      for (const resource of resourcesResponse.StackResources || []) {
        if (resource.ResourceType === "AWS::Logs::LogGroup") {
          if (resource.PhysicalResourceId) {
            managedLogGroups.add(resource.PhysicalResourceId);
          }
        }
      }
    } catch {
      // Stack doesn't exist or access denied - return empty set
    }

    return managedLogGroups;
  }

  /**
   * Check for orphaned CloudWatch log groups
   */
  async checkLogGroups(): Promise<OrphanedResource[]> {
    const orphans: OrphanedResource[] = [];
    const { appName, stage } = this.config;
    const stackName = `${appName}-${stage}`;
    const prefix = `/aws/lambda/${appName}-`;

    this.config.logger.info(`Checking for orphaned log groups (prefix: ${prefix})...`);

    try {
      // Get log groups matching the app prefix
      const logGroupsResponse = await this.cloudwatchClient.send(
        new DescribeLogGroupsCommand({
          logGroupNamePrefix: prefix,
        })
      );

      const logGroups = logGroupsResponse.logGroups || [];

      if (logGroups.length === 0) {
        this.config.logger.success("No log groups found with matching prefix");
        return orphans;
      }

      // Get managed log groups from CloudFormation
      const managedLogGroups = await this.getManagedLogGroups(stackName);

      // Also check nested stacks
      try {
        const stacksResponse = await this.cfnClient.send(
          new ListStacksCommand({
            StackStatusFilter: [
              "CREATE_COMPLETE",
              "UPDATE_COMPLETE",
              "UPDATE_ROLLBACK_COMPLETE",
            ],
          })
        );

        const nestedStacks =
          stacksResponse.StackSummaries?.filter((s) =>
            s.StackName?.startsWith(`${stackName}-`)
          ) || [];

        for (const nested of nestedStacks) {
          if (nested.StackName) {
            const nestedManaged = await this.getManagedLogGroups(nested.StackName);
            for (const lg of nestedManaged) {
              managedLogGroups.add(lg);
            }
          }
        }
      } catch {
        // Ignore nested stack errors
      }

      // Find orphans (log groups matching prefix but not managed by CFN)
      for (const lg of logGroups) {
        const logGroupName = lg.logGroupName || "";

        // Only check log groups for this stage
        if (!logGroupName.includes(`-${stage}`)) {
          continue;
        }

        if (!managedLogGroups.has(logGroupName)) {
          orphans.push({
            type: "log-group",
            name: logGroupName,
            reason: "Not managed by CloudFormation (possibly from failed deployment)",
          });
        }
      }

      if (orphans.length > 0) {
        this.config.logger.warning(
          `Found ${orphans.length} orphaned log group(s)`
        );
      } else {
        this.config.logger.success("No orphaned log groups found");
      }
    } catch (error) {
      this.config.logger.error(
        `Error checking log groups: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return orphans;
  }

  /**
   * Check for orphaned S3 buckets
   */
  async checkS3Buckets(): Promise<OrphanedResource[]> {
    const orphans: OrphanedResource[] = [];
    const { appName, stage } = this.config;

    this.config.logger.info("Checking for orphaned S3 buckets...");

    try {
      const bucketsResponse = await this.s3Client.send(new ListBucketsCommand({}));
      const buckets = bucketsResponse.Buckets || [];

      // Look for buckets matching the app-stage pattern (excluding template bucket)
      const stageBuckets = buckets.filter(
        (b) =>
          b.Name?.includes(`${appName}`) &&
          b.Name?.includes(`${stage}`) &&
          !b.Name?.includes("deploy-templates")
      );

      // Get managed buckets from CloudFormation
      const stackName = `${appName}-${stage}`;
      const managedBuckets = new Set<string>();

      try {
        const resourcesResponse = await this.cfnClient.send(
          new DescribeStackResourcesCommand({ StackName: stackName })
        );

        for (const resource of resourcesResponse.StackResources || []) {
          if (resource.ResourceType === "AWS::S3::Bucket") {
            if (resource.PhysicalResourceId) {
              managedBuckets.add(resource.PhysicalResourceId);
            }
          }
        }

        // Check nested stacks too
        const stacksResponse = await this.cfnClient.send(
          new ListStacksCommand({
            StackStatusFilter: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
          })
        );

        const nestedStacks =
          stacksResponse.StackSummaries?.filter((s) =>
            s.StackName?.startsWith(`${stackName}-`)
          ) || [];

        for (const nested of nestedStacks) {
          if (nested.StackName) {
            try {
              const nestedResources = await this.cfnClient.send(
                new DescribeStackResourcesCommand({ StackName: nested.StackName })
              );
              for (const resource of nestedResources.StackResources || []) {
                if (resource.ResourceType === "AWS::S3::Bucket") {
                  if (resource.PhysicalResourceId) {
                    managedBuckets.add(resource.PhysicalResourceId);
                  }
                }
              }
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Stack doesn't exist
      }

      for (const bucket of stageBuckets) {
        if (bucket.Name && !managedBuckets.has(bucket.Name)) {
          orphans.push({
            type: "s3-bucket",
            name: bucket.Name,
            reason: "Not managed by CloudFormation",
          });
        }
      }

      if (orphans.length > 0) {
        this.config.logger.warning(`Found ${orphans.length} orphaned S3 bucket(s)`);
      } else {
        this.config.logger.success("No orphaned S3 buckets found");
      }
    } catch (error) {
      this.config.logger.error(
        `Error checking S3 buckets: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return orphans;
  }

  /**
   * Check for orphaned Cognito user pools
   */
  async checkCognitoPools(): Promise<OrphanedResource[]> {
    const orphans: OrphanedResource[] = [];
    const { appName, stage } = this.config;

    this.config.logger.info("Checking for orphaned Cognito user pools...");

    try {
      const poolsResponse = await this.cognitoClient.send(
        new ListUserPoolsCommand({ MaxResults: 60 })
      );

      const pools = poolsResponse.UserPools || [];

      // Look for pools matching the app-stage pattern
      const stagePools = pools.filter(
        (p) => p.Name?.includes(appName) && p.Name?.includes(stage)
      );

      // Get managed pools from CloudFormation
      const stackName = `${appName}-${stage}`;
      const managedPools = new Set<string>();

      try {
        // Check main stack and nested stacks
        const stacksResponse = await this.cfnClient.send(
          new ListStacksCommand({
            StackStatusFilter: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
          })
        );

        const allStacks = [
          stackName,
          ...(stacksResponse.StackSummaries?.filter((s) =>
            s.StackName?.startsWith(`${stackName}-`)
          ).map((s) => s.StackName!) || []),
        ];

        for (const stack of allStacks) {
          try {
            const resourcesResponse = await this.cfnClient.send(
              new DescribeStackResourcesCommand({ StackName: stack })
            );

            for (const resource of resourcesResponse.StackResources || []) {
              if (
                resource.ResourceType === "AWS::Cognito::UserPool" &&
                resource.PhysicalResourceId
              ) {
                managedPools.add(resource.PhysicalResourceId);
              }
            }
          } catch {
            // Ignore
          }
        }
      } catch {
        // Stack doesn't exist
      }

      for (const pool of stagePools) {
        if (pool.Id && !managedPools.has(pool.Id)) {
          orphans.push({
            type: "cognito-pool",
            name: `${pool.Name} (${pool.Id})`,
            reason: "Not managed by CloudFormation",
          });
        }
      }

      if (orphans.length > 0) {
        this.config.logger.warning(
          `Found ${orphans.length} orphaned Cognito pool(s)`
        );
      } else {
        this.config.logger.success("No orphaned Cognito pools found");
      }
    } catch (error) {
      this.config.logger.error(
        `Error checking Cognito pools: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return orphans;
  }

  /**
   * Check all resource types for orphans
   */
  async checkAll(): Promise<OrphanedResource[]> {
    const allOrphans: OrphanedResource[] = [];

    console.log("\n" + "=".repeat(60));
    console.log("Orphan Resource Check");
    console.log("=".repeat(60) + "\n");

    const logGroupOrphans = await this.checkLogGroups();
    allOrphans.push(...logGroupOrphans);

    const s3Orphans = await this.checkS3Buckets();
    allOrphans.push(...s3Orphans);

    const cognitoOrphans = await this.checkCognitoPools();
    allOrphans.push(...cognitoOrphans);

    return allOrphans;
  }

  /**
   * Delete orphaned log groups
   */
  async deleteLogGroups(logGroupNames: string[]): Promise<void> {
    for (const name of logGroupNames) {
      try {
        await this.cloudwatchClient.send(
          new DeleteLogGroupCommand({ logGroupName: name })
        );
        this.config.logger.success(`Deleted log group: ${name}`);
      } catch (error) {
        this.config.logger.error(
          `Failed to delete log group ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Interactive orphan cleanup
   */
  async interactiveCleanup(orphans: OrphanedResource[]): Promise<void> {
    if (orphans.length === 0) {
      console.log("\nNo orphaned resources found. Stack is clean.\n");
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log("Found Orphaned Resources:");
    console.log("=".repeat(60));

    for (const orphan of orphans) {
      const typeLabel =
        orphan.type === "log-group"
          ? "Log Group"
          : orphan.type === "s3-bucket"
            ? "S3 Bucket"
            : "Cognito Pool";
      console.log(`\n  [${typeLabel}] ${orphan.name}`);
      console.log(`    Reason: ${orphan.reason}`);
    }

    console.log("\n" + "=".repeat(60));

    // Auto-delete log groups (safe and common)
    const logGroupOrphans = orphans.filter((o) => o.type === "log-group");
    if (logGroupOrphans.length > 0) {
      console.log(
        `\nDeleting ${logGroupOrphans.length} orphaned log group(s)...`
      );
      await this.deleteLogGroups(logGroupOrphans.map((o) => o.name));
    }

    // Warn about other resources (need manual intervention)
    const otherOrphans = orphans.filter((o) => o.type !== "log-group");
    if (otherOrphans.length > 0) {
      console.log("\n⚠️  The following resources require manual cleanup:");
      for (const orphan of otherOrphans) {
        console.log(`    - ${orphan.type}: ${orphan.name}`);
      }
      console.log(
        "\nS3 buckets must be emptied before deletion."
      );
      console.log(
        "Cognito pools may have users that need to be migrated."
      );
    }

    console.log("");
  }
}
