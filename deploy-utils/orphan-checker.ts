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
 * The orphan checker uses the shared deploy user credentials.
 * The deploy user must have:
 * - logs:DescribeLogGroups, logs:DeleteLogGroup
 * - lambda:ListFunctions, lambda:DeleteFunction
 * - s3:ListAllMyBuckets
 * - dynamodb:ListTables
 * - appsync:ListGraphqlApis
 * - cognito-idp:ListUserPools
 * - iam:ListRoles
 * - cloudformation:ListStacks, cloudformation:DescribeStackResources
 *
 * Set credentials in .env as DEPLOY_USER_KEY and DEPLOY_USER_SECRET.
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
import {
  LambdaClient,
  ListFunctionsCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import {
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import {
  AppSyncClient,
  ListGraphqlApisCommand,
} from "@aws-sdk/client-appsync";
import {
  IAMClient,
  ListRolesCommand,
} from "@aws-sdk/client-iam";

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
 * Get AWS client config with deploy user credentials if available
 */
function getClientConfig(region: string) {
  const accessKeyId = process.env.DEPLOY_USER_KEY;
  const secretAccessKey = process.env.DEPLOY_USER_SECRET;

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
  type: "log-group" | "s3-bucket" | "cognito-pool" | "lambda" | "dynamodb-table" | "appsync-api" | "iam-role";
  name: string;
  reason: string;
}

export class OrphanChecker {
  private config: OrphanCheckerConfig;
  private cloudwatchClient: CloudWatchLogsClient;
  private cfnClient: CloudFormationClient;
  private cognitoClient: CognitoIdentityProviderClient;
  private s3Client: S3Client;
  private lambdaClient: LambdaClient;
  private dynamoClient: DynamoDBClient;
  private appsyncClient: AppSyncClient;
  private iamClient: IAMClient;

  constructor(config: OrphanCheckerConfig) {
    this.config = config;
    const clientConfig = getClientConfig(config.region);
    this.cloudwatchClient = new CloudWatchLogsClient(clientConfig);
    this.cfnClient = new CloudFormationClient(clientConfig);
    this.cognitoClient = new CognitoIdentityProviderClient(clientConfig);
    this.s3Client = new S3Client(clientConfig);
    this.lambdaClient = new LambdaClient(clientConfig);
    this.dynamoClient = new DynamoDBClient(clientConfig);
    this.appsyncClient = new AppSyncClient(clientConfig);
    this.iamClient = new IAMClient(clientConfig);
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
   * Check for orphaned Lambda functions
   */
  async checkLambdaFunctions(): Promise<OrphanedResource[]> {
    const orphans: OrphanedResource[] = [];
    const { appName, stage } = this.config;
    const prefix = `${appName}-${stage}`;

    this.config.logger.info(`Checking for orphaned Lambda functions (prefix: ${prefix})...`);

    try {
      // Get all Lambda functions matching the prefix
      const functionsResponse = await this.lambdaClient.send(
        new ListFunctionsCommand({})
      );

      const functions = (functionsResponse.Functions || []).filter(
        (f) => f.FunctionName?.startsWith(prefix)
      );

      if (functions.length === 0) {
        this.config.logger.success("No Lambda functions found with matching prefix");
        return orphans;
      }

      // Get managed Lambda functions from CloudFormation
      const managedFunctions = await this.getManagedResources(
        `${appName}-${stage}`,
        "AWS::Lambda::Function"
      );

      for (const func of functions) {
        if (func.FunctionName && !managedFunctions.has(func.FunctionName)) {
          orphans.push({
            type: "lambda",
            name: func.FunctionName,
            reason: "Not managed by CloudFormation (possibly from failed deployment)",
          });
        }
      }

      if (orphans.length > 0) {
        this.config.logger.warning(`Found ${orphans.length} orphaned Lambda function(s)`);
      } else {
        this.config.logger.success("No orphaned Lambda functions found");
      }
    } catch (error) {
      this.config.logger.error(
        `Error checking Lambda functions: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return orphans;
  }

  /**
   * Check for orphaned DynamoDB tables
   */
  async checkDynamoDBTables(): Promise<OrphanedResource[]> {
    const orphans: OrphanedResource[] = [];
    const { appName, stage } = this.config;

    this.config.logger.info("Checking for orphaned DynamoDB tables...");

    try {
      const tablesResponse = await this.dynamoClient.send(
        new ListTablesCommand({})
      );

      const tables = (tablesResponse.TableNames || []).filter(
        (name) => name.includes(appName) && name.includes(stage)
      );

      if (tables.length === 0) {
        this.config.logger.success("No DynamoDB tables found with matching pattern");
        return orphans;
      }

      // Get managed tables from CloudFormation
      const managedTables = await this.getManagedResources(
        `${appName}-${stage}`,
        "AWS::DynamoDB::Table"
      );

      for (const tableName of tables) {
        if (!managedTables.has(tableName)) {
          orphans.push({
            type: "dynamodb-table",
            name: tableName,
            reason: "Not managed by CloudFormation",
          });
        }
      }

      if (orphans.length > 0) {
        this.config.logger.warning(`Found ${orphans.length} orphaned DynamoDB table(s)`);
      } else {
        this.config.logger.success("No orphaned DynamoDB tables found");
      }
    } catch (error) {
      this.config.logger.error(
        `Error checking DynamoDB tables: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return orphans;
  }

  /**
   * Check for orphaned AppSync APIs
   */
  async checkAppSyncAPIs(): Promise<OrphanedResource[]> {
    const orphans: OrphanedResource[] = [];
    const { appName, stage } = this.config;

    this.config.logger.info("Checking for orphaned AppSync APIs...");

    try {
      const apisResponse = await this.appsyncClient.send(
        new ListGraphqlApisCommand({})
      );

      const apis = (apisResponse.graphqlApis || []).filter(
        (api) => api.name?.includes(appName) && api.name?.includes(stage)
      );

      if (apis.length === 0) {
        this.config.logger.success("No AppSync APIs found with matching pattern");
        return orphans;
      }

      // Get managed APIs from CloudFormation
      const managedAPIs = await this.getManagedResources(
        `${appName}-${stage}`,
        "AWS::AppSync::GraphQLApi"
      );

      for (const api of apis) {
        if (api.apiId && !managedAPIs.has(api.apiId)) {
          orphans.push({
            type: "appsync-api",
            name: `${api.name} (${api.apiId})`,
            reason: "Not managed by CloudFormation",
          });
        }
      }

      if (orphans.length > 0) {
        this.config.logger.warning(`Found ${orphans.length} orphaned AppSync API(s)`);
      } else {
        this.config.logger.success("No orphaned AppSync APIs found");
      }
    } catch (error) {
      this.config.logger.error(
        `Error checking AppSync APIs: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return orphans;
  }

  /**
   * Check for orphaned IAM roles
   */
  async checkIAMRoles(): Promise<OrphanedResource[]> {
    const orphans: OrphanedResource[] = [];
    const { appName, stage } = this.config;

    this.config.logger.info("Checking for orphaned IAM roles...");

    try {
      const rolesResponse = await this.iamClient.send(
        new ListRolesCommand({})
      );

      const roles = (rolesResponse.Roles || []).filter(
        (role) => role.RoleName?.includes(appName) && role.RoleName?.includes(stage)
      );

      if (roles.length === 0) {
        this.config.logger.success("No IAM roles found with matching pattern");
        return orphans;
      }

      // Get managed roles from CloudFormation
      const managedRoles = await this.getManagedResources(
        `${appName}-${stage}`,
        "AWS::IAM::Role"
      );

      for (const role of roles) {
        if (role.RoleName && !managedRoles.has(role.RoleName)) {
          orphans.push({
            type: "iam-role",
            name: role.RoleName,
            reason: "Not managed by CloudFormation",
          });
        }
      }

      if (orphans.length > 0) {
        this.config.logger.warning(`Found ${orphans.length} orphaned IAM role(s)`);
      } else {
        this.config.logger.success("No orphaned IAM roles found");
      }
    } catch (error) {
      this.config.logger.error(
        `Error checking IAM roles: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return orphans;
  }

  /**
   * Generic helper to get managed resources of a given type from CloudFormation
   */
  private async getManagedResources(
    stackName: string,
    resourceType: string
  ): Promise<Set<string>> {
    const managedResources = new Set<string>();

    try {
      // Check main stack
      const resourcesResponse = await this.cfnClient.send(
        new DescribeStackResourcesCommand({ StackName: stackName })
      );

      for (const resource of resourcesResponse.StackResources || []) {
        if (resource.ResourceType === resourceType && resource.PhysicalResourceId) {
          managedResources.add(resource.PhysicalResourceId);
        }
      }

      // Check nested stacks
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
              if (resource.ResourceType === resourceType && resource.PhysicalResourceId) {
                managedResources.add(resource.PhysicalResourceId);
              }
            }
          } catch {
            // Ignore nested stack errors
          }
        }
      }
    } catch {
      // Stack doesn't exist or access denied
    }

    return managedResources;
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

    const lambdaOrphans = await this.checkLambdaFunctions();
    allOrphans.push(...lambdaOrphans);

    const s3Orphans = await this.checkS3Buckets();
    allOrphans.push(...s3Orphans);

    const dynamoOrphans = await this.checkDynamoDBTables();
    allOrphans.push(...dynamoOrphans);

    const appsyncOrphans = await this.checkAppSyncAPIs();
    allOrphans.push(...appsyncOrphans);

    const cognitoOrphans = await this.checkCognitoPools();
    allOrphans.push(...cognitoOrphans);

    const iamOrphans = await this.checkIAMRoles();
    allOrphans.push(...iamOrphans);

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
   * Delete orphaned Lambda functions
   */
  async deleteLambdaFunctions(functionNames: string[]): Promise<void> {
    for (const name of functionNames) {
      try {
        await this.lambdaClient.send(
          new DeleteFunctionCommand({ FunctionName: name })
        );
        this.config.logger.success(`Deleted Lambda function: ${name}`);
      } catch (error) {
        this.config.logger.error(
          `Failed to delete Lambda function ${name}: ${error instanceof Error ? error.message : String(error)}`
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

    const typeLabels: Record<OrphanedResource["type"], string> = {
      "log-group": "Log Group",
      "s3-bucket": "S3 Bucket",
      "cognito-pool": "Cognito Pool",
      "lambda": "Lambda Function",
      "dynamodb-table": "DynamoDB Table",
      "appsync-api": "AppSync API",
      "iam-role": "IAM Role",
    };

    for (const orphan of orphans) {
      const typeLabel = typeLabels[orphan.type] || orphan.type;
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

    // Auto-delete Lambda functions (safe - they can be recreated)
    const lambdaOrphans = orphans.filter((o) => o.type === "lambda");
    if (lambdaOrphans.length > 0) {
      console.log(
        `\nDeleting ${lambdaOrphans.length} orphaned Lambda function(s)...`
      );
      await this.deleteLambdaFunctions(lambdaOrphans.map((o) => o.name));
    }

    // Warn about other resources (need manual intervention)
    const autoDeleteTypes = ["log-group", "lambda"];
    const otherOrphans = orphans.filter((o) => !autoDeleteTypes.includes(o.type));
    if (otherOrphans.length > 0) {
      console.log("\n⚠️  The following resources require manual cleanup:");
      for (const orphan of otherOrphans) {
        const typeLabel = typeLabels[orphan.type] || orphan.type;
        console.log(`    - [${typeLabel}] ${orphan.name}`);
      }
      console.log("\nManual cleanup notes:");
      console.log("  • S3 buckets must be emptied before deletion");
      console.log("  • DynamoDB tables may contain data that needs backup");
      console.log("  • Cognito pools may have users that need migration");
      console.log("  • IAM roles may be used by other resources");
      console.log("  • AppSync APIs may have connected clients");
    }

    console.log("");
  }
}
