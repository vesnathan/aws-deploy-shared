/**
 * Orphaned Resource Cleanup Utility
 *
 * Scans for and deletes orphaned AWS resources that are no longer associated with active stacks
 * Adapted from The Story Hub implementation for use across all projects
 */

import {
  CloudFormationClient,
  ListStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  IAMClient,
  ListRolesCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
  ListRolePoliciesCommand,
  DeleteRolePolicyCommand,
  DeleteRoleCommand,
} from "@aws-sdk/client-iam";
import {
  LambdaClient,
  ListFunctionsCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import {
  DynamoDBClient,
  ListTablesCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  DeleteUserPoolCommand,
  ListIdentityProvidersCommand,
  DeleteIdentityProviderCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  S3Client,
  ListBucketsCommand,
  ListObjectVersionsCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  ListDistributionsCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";
import type { OrphanCleanupOptions, Logger } from "./types";

interface ErrorWithMessage {
  message?: string;
}

export class OrphanCleanup {
  private cfnClient: CloudFormationClient;
  private iamClient: IAMClient;
  private lambdaClient: LambdaClient;
  private dynamoClient: DynamoDBClient;
  private cognitoClient: CognitoIdentityProviderClient;
  private s3Client: S3Client;
  private cloudFrontClient: CloudFrontClient;
  private options: OrphanCleanupOptions;
  private logger: Logger;
  private failedCleanups: Array<{ resource: string; error: string }> = [];

  constructor(options: OrphanCleanupOptions) {
    this.options = options;
    this.logger = options.logger;
    this.cfnClient = new CloudFormationClient({ region: options.region });
    this.iamClient = new IAMClient({ region: options.region });
    this.lambdaClient = new LambdaClient({ region: options.region });
    this.dynamoClient = new DynamoDBClient({ region: options.region });
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: options.region,
    });
    this.s3Client = new S3Client({ region: options.region });
    this.cloudFrontClient = new CloudFrontClient({ region: options.region });
  }

  /**
   * Check if a resource name matches our app/stage pattern
   */
  private matchesPattern(resourceName: string): boolean {
    const patterns = [
      `${this.options.appName}-${this.options.stage}`,
      `${this.options.appName.toLowerCase()}-${this.options.stage}`,
    ];
    return patterns.some((pattern) => resourceName.includes(pattern));
  }

  /**
   * Clean up orphaned IAM roles
   */
  async cleanupOrphanedRoles(): Promise<void> {
    this.logger.info("Checking for orphaned IAM roles...");
    try {
      const response = await this.iamClient.send(new ListRolesCommand({}));

      for (const role of response.Roles || []) {
        if (!role.RoleName || !this.matchesPattern(role.RoleName)) {
          continue;
        }

        // Skip CloudFormation deployment role (created by IamManager, not CloudFormation)
        const deploymentRolePattern = `${this.options.appName}-${this.options.stage}-role`;
        if (role.RoleName === deploymentRolePattern) {
          this.logger.debug(
            `Skipping CloudFormation deployment role: ${role.RoleName}`
          );
          continue;
        }

        this.logger.warning(`Found IAM role to delete: ${role.RoleName}`);
        if (!this.options.dryRun) {
          try {
            await this.deleteRole(role.RoleName);
          } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            const errorMsg = `Failed to delete IAM role ${role.RoleName}: ${err.message || String(error)}`;
            this.logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `IAM Role: ${role.RoleName}`,
              error: err.message || String(error),
            });
          }
        }
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      this.logger.error(`Failed to list IAM roles: ${err.message || String(error)}`);
      this.failedCleanups.push({
        resource: "IAM Roles (list operation)",
        error: err.message || String(error),
      });
    }
  }

  /**
   * Delete an IAM role and all its policies
   */
  private async deleteRole(roleName: string): Promise<void> {
    // Detach managed policies
    const attachedPolicies = await this.iamClient.send(
      new ListAttachedRolePoliciesCommand({ RoleName: roleName })
    );
    for (const policy of attachedPolicies.AttachedPolicies || []) {
      await this.iamClient.send(
        new DetachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: policy.PolicyArn,
        })
      );
    }

    // Delete inline policies
    const inlinePolicies = await this.iamClient.send(
      new ListRolePoliciesCommand({ RoleName: roleName })
    );
    for (const policyName of inlinePolicies.PolicyNames || []) {
      await this.iamClient.send(
        new DeleteRolePolicyCommand({
          RoleName: roleName,
          PolicyName: policyName,
        })
      );
    }

    // Delete role
    await this.iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
    this.logger.info(`✓ Deleted orphaned IAM role: ${roleName}`);
  }

  /**
   * Clean up orphaned Lambda functions
   */
  async cleanupOrphanedLambdas(): Promise<void> {
    this.logger.info("Checking for orphaned Lambda functions...");
    try {
      const response = await this.lambdaClient.send(new ListFunctionsCommand({}));

      for (const func of response.Functions || []) {
        if (!func.FunctionName || !this.matchesPattern(func.FunctionName)) {
          continue;
        }

        this.logger.warning(`Found orphaned Lambda function: ${func.FunctionName}`);
        if (!this.options.dryRun) {
          try {
            await this.lambdaClient.send(
              new DeleteFunctionCommand({ FunctionName: func.FunctionName })
            );
            this.logger.info(`✓ Deleted orphaned Lambda: ${func.FunctionName}`);
          } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            const errorMsg = `Failed to delete Lambda ${func.FunctionName}: ${err.message || String(error)}`;
            this.logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `Lambda: ${func.FunctionName}`,
              error: err.message || String(error),
            });
          }
        }
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      this.logger.error(`Failed to list Lambda functions: ${err.message || String(error)}`);
      this.failedCleanups.push({
        resource: "Lambda Functions (list operation)",
        error: err.message || String(error),
      });
    }
  }

  /**
   * Clean up orphaned DynamoDB tables
   */
  async cleanupOrphanedTables(): Promise<void> {
    this.logger.info("Checking for orphaned DynamoDB tables...");
    try {
      const response = await this.dynamoClient.send(new ListTablesCommand({}));

      for (const tableName of response.TableNames || []) {
        if (!this.matchesPattern(tableName)) {
          continue;
        }

        this.logger.warning(`Found orphaned DynamoDB table: ${tableName}`);
        if (!this.options.dryRun) {
          try {
            await this.dynamoClient.send(
              new DeleteTableCommand({ TableName: tableName })
            );
            this.logger.info(`✓ Deleted orphaned DynamoDB table: ${tableName}`);
          } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            const errorMsg = `Failed to delete DynamoDB table ${tableName}: ${err.message || String(error)}`;
            this.logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `DynamoDB Table: ${tableName}`,
              error: err.message || String(error),
            });
          }
        }
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      this.logger.error(`Failed to list DynamoDB tables: ${err.message || String(error)}`);
      this.failedCleanups.push({
        resource: "DynamoDB Tables (list operation)",
        error: err.message || String(error),
      });
    }
  }

  /**
   * Clean up orphaned Cognito User Pools
   */
  async cleanupOrphanedUserPools(): Promise<void> {
    this.logger.info("Checking for orphaned Cognito User Pools...");
    try {
      const response = await this.cognitoClient.send(
        new ListUserPoolsCommand({ MaxResults: 60 })
      );

      for (const pool of response.UserPools || []) {
        if (!pool.Name || !this.matchesPattern(pool.Name)) {
          continue;
        }

        this.logger.warning(
          `Found orphaned Cognito User Pool: ${pool.Name} (${pool.Id})`
        );
        if (!this.options.dryRun && pool.Id) {
          try {
            // Delete identity providers first to avoid secret resolution issues
            try {
              const identityProviders = await this.cognitoClient.send(
                new ListIdentityProvidersCommand({
                  UserPoolId: pool.Id,
                  MaxResults: 60,
                })
              );

              for (const provider of identityProviders.Providers || []) {
                if (provider.ProviderName) {
                  this.logger.info(
                    `  Deleting identity provider: ${provider.ProviderName}`
                  );
                  await this.cognitoClient.send(
                    new DeleteIdentityProviderCommand({
                      UserPoolId: pool.Id,
                      ProviderName: provider.ProviderName,
                    })
                  );
                }
              }
            } catch (providerError: unknown) {
              const pErr = providerError as ErrorWithMessage;
              this.logger.debug(
                `Could not delete identity providers: ${pErr.message || String(providerError)}`
              );
              // Continue anyway - the providers might not exist
            }

            // Now delete the user pool
            await this.cognitoClient.send(
              new DeleteUserPoolCommand({ UserPoolId: pool.Id })
            );
            this.logger.info(`✓ Deleted orphaned Cognito User Pool: ${pool.Name}`);
          } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            const errorMsg = `Failed to delete User Pool ${pool.Name}: ${err.message || String(error)}`;
            this.logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `Cognito User Pool: ${pool.Name} (${pool.Id})`,
              error: err.message || String(error),
            });
          }
        }
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      this.logger.error(`Failed to list Cognito User Pools: ${err.message || String(error)}`);
      this.failedCleanups.push({
        resource: "Cognito User Pools (list operation)",
        error: err.message || String(error),
      });
    }
  }

  /**
   * Clean up orphaned S3 buckets
   */
  async cleanupOrphanedBuckets(): Promise<void> {
    this.logger.info("Checking for orphaned S3 buckets...");
    try {
      const response = await this.s3Client.send(new ListBucketsCommand({}));
      const allBuckets = response.Buckets || [];
      this.logger.debug(`Found ${allBuckets.length} total S3 buckets`);

      for (const bucket of allBuckets) {
        if (!bucket.Name || !this.matchesPattern(bucket.Name)) {
          continue;
        }

        this.logger.warning(`Found orphaned S3 bucket: ${bucket.Name}`);
        if (!this.options.dryRun) {
          try {
            await this.emptyAndDeleteBucket(bucket.Name);
          } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            const errorMsg = `Failed to delete S3 bucket ${bucket.Name}: ${err.message || String(error)}`;
            this.logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `S3 Bucket: ${bucket.Name}`,
              error: err.message || String(error),
            });
          }
        }
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      this.logger.error(`Failed to list S3 buckets: ${err.message || String(error)}`);
      this.failedCleanups.push({
        resource: "S3 Buckets (list operation)",
        error: err.message || String(error),
      });
    }
  }

  /**
   * Empty and delete an S3 bucket
   */
  private async emptyAndDeleteBucket(bucketName: string): Promise<void> {
    // List and delete all object versions
    let isTruncated = true;
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;

    while (isTruncated) {
      const versions = await this.s3Client.send(
        new ListObjectVersionsCommand({
          Bucket: bucketName,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        })
      );

      // Delete versions
      for (const version of versions.Versions || []) {
        if (version.Key) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: version.Key,
              VersionId: version.VersionId,
            })
          );
        }
      }

      // Delete delete markers
      for (const marker of versions.DeleteMarkers || []) {
        if (marker.Key) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: marker.Key,
              VersionId: marker.VersionId,
            })
          );
        }
      }

      isTruncated = versions.IsTruncated || false;
      keyMarker = versions.NextKeyMarker;
      versionIdMarker = versions.NextVersionIdMarker;
    }

    // Delete bucket
    await this.s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    this.logger.info(`✓ Deleted orphaned S3 bucket: ${bucketName}`);
  }

  /**
   * Clean up orphaned CloudFront distributions
   */
  async cleanupOrphanedDistributions(): Promise<void> {
    this.logger.info("Checking for orphaned CloudFront distributions...");
    try {
      const response = await this.cloudFrontClient.send(
        new ListDistributionsCommand({})
      );

      for (const dist of response.DistributionList?.Items || []) {
        if (!dist.Comment || !this.matchesPattern(dist.Comment)) {
          continue;
        }

        this.logger.warning(
          `Found orphaned CloudFront distribution: ${dist.Id} (${dist.Comment})`
        );
        if (!this.options.dryRun && dist.Id) {
          try {
            // Disable distribution first
            const config = await this.cloudFrontClient.send(
              new GetDistributionConfigCommand({ Id: dist.Id })
            );
            if (config.DistributionConfig && config.ETag) {
              config.DistributionConfig.Enabled = false;
              await this.cloudFrontClient.send(
                new UpdateDistributionCommand({
                  Id: dist.Id,
                  DistributionConfig: config.DistributionConfig,
                  IfMatch: config.ETag,
                })
              );
              this.logger.info(
                `✓ Disabled CloudFront distribution: ${dist.Id} (will delete after propagation)`
              );
            }
          } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            const errorMsg = `Failed to disable CloudFront distribution ${dist.Id}: ${err.message || String(error)}`;
            this.logger.error(errorMsg);
            this.failedCleanups.push({
              resource: `CloudFront Distribution: ${dist.Id} (${dist.Comment})`,
              error: err.message || String(error),
            });
          }
        }
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      this.logger.error(`Failed to list CloudFront distributions: ${err.message || String(error)}`);
      this.failedCleanups.push({
        resource: "CloudFront Distributions (list operation)",
        error: err.message || String(error),
      });
    }
  }

  /**
   * Run full cleanup
   */
  async cleanupAll(): Promise<void> {
    this.logger.info(
      `Starting orphan cleanup for ${this.options.appName}-${this.options.stage}${this.options.dryRun ? " (DRY RUN)" : ""}`
    );

    // Reset failed cleanups tracker
    this.failedCleanups = [];

    await this.cleanupOrphanedLambdas();
    await this.cleanupOrphanedTables();
    await this.cleanupOrphanedUserPools();
    await this.cleanupOrphanedRoles();
    await this.cleanupOrphanedBuckets();
    await this.cleanupOrphanedDistributions();

    // Log failed cleanups but don't throw (orphan cleanup should not block)
    if (this.failedCleanups.length > 0) {
      this.logger.warning(
        `Orphan cleanup failed for ${this.failedCleanups.length} resource(s):`
      );
      for (const failure of this.failedCleanups) {
        this.logger.warning(`  - ${failure.resource}: ${failure.error}`);
      }
    } else {
      this.logger.success("Orphan cleanup complete - no orphaned resources found");
    }
  }
}
