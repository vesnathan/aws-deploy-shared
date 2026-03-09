/**
 * Removal Orchestrator - Main 12-Step Removal Logic
 *
 * ⚠️ CRITICAL: This is the ONLY removal implementation used by ALL projects!
 * Test changes against all integrated projects before committing.
 *
 * Projects call removeStack() with their configuration
 *
 * @see /home/liqk1ugzoezh5okwywlr_/dev/shared/deploy-utils/README.md
 *
 * Standard 12-Step Process:
 * 1. Parse CLI args or show interactive menu (handled by project)
 * 2. Get stack details from CloudFormation
 * 3. CHECK FOR USERS (query Cognito)
 * 4. Display ASCII warning box
 * 5. Confirm deletion (type stack name)
 * 6. If users found + no --force-with-users → BLOCK
 * 7. Empty all S3 buckets
 * 8. Delete custom resources / secrets (via preDeleteHook)
 * 9. Delete CloudFormation stack
 * 10. Wait for deletion (30 min timeout)
 * 11. Cleanup orphaned resources
 * 12. Log completion + retained resources
 */

import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { checkCognitoUsers } from "./user-safety";
import {
  formatDeletionWarning,
  confirmDeletion,
  displayProgress,
  displayError,
  displaySuccess,
} from "./confirmation-prompts";
import { emptyS3Bucket, listBucketsForStack } from "./s3-cleanup";
import { forceDeleteStack, stackExists } from "./stack-deletion";
import { OrphanCleanup } from "./orphan-cleanup";
import type { RemovalConfig, DeletionResult } from "./types";

/**
 * Remove an AWS CloudFormation stack with all resources
 *
 * This is the main entry point for stack removal across all projects
 * Implements a consistent 12-step removal process with user safety checks
 *
 * @param config Removal configuration from calling project
 * @returns DeletionResult with success status and details
 */
export async function removeStack(config: RemovalConfig): Promise<DeletionResult> {
  const {
    stackName,
    region,
    appName,
    stage,
    forceWithUsers,
    skipConfirmation,
    logger,
    preDeleteHook,
    postDeleteHook,
    customBuckets,
    additionalRegions,
  } = config;

  const result: DeletionResult = {
    success: false,
    stackDeleted: false,
    bucketsEmptied: [],
    orphansCleanedUp: false,
    retainedResources: [],
    errors: [],
  };

  try {
    logger.header(`Removing Stack: ${stackName}`);

    // STEP 2: Check if stack exists
    displayProgress("Checking if stack exists...");
    const exists = await stackExists(stackName, region);

    if (!exists) {
      logger.warning(`Stack ${stackName} does not exist`);
      result.success = true;
      return result;
    }

    // Get stack details
    const cfnClient = new CloudFormationClient({ region });
    const describeResponse = await cfnClient.send(
      new DescribeStacksCommand({ StackName: stackName })
    );

    const stack = describeResponse.Stacks?.[0];
    if (!stack) {
      logger.warning(`Stack ${stackName} not found`);
      result.success = true;
      return result;
    }

    logger.debug(`Stack status: ${stack.StackStatus}`);

    // Get SeedRoleArn from stack outputs for Cognito access
    const outputs = stack.Outputs || [];
    const seedRoleArn = outputs.find((o) => o.OutputKey === "SeedRoleArn")?.OutputValue;

    if (seedRoleArn) {
      logger.debug(`Using SeedRoleArn for Cognito access: ${seedRoleArn}`);
    }

    // STEP 3: CHECK FOR USERS
    displayProgress("Checking for active Cognito users...");
    const userCheck = await checkCognitoUsers({
      stackName,
      region,
      stage,
      appName,
      seedRoleArn, // Pass the SeedRoleArn for elevated permissions
    });

    if (userCheck.error) {
      logger.debug(userCheck.error);
    }

    // STEP 4: Display warning
    const warning = formatDeletionWarning({
      stackName,
      stage,
      userCheck,
      resources: [
        "CloudFormation Stack",
        "DynamoDB Tables",
        "S3 Buckets (all data)",
        "Cognito User Pool (all users)",
        "Lambda Functions",
        "AppSync GraphQL API",
        "CloudFront Distribution",
      ],
      forceAllowed: true,
    });

    console.log(warning);

    // STEP 5: Confirm deletion
    if (!skipConfirmation) {
      const confirmed = await confirmDeletion(stackName, false);
      if (!confirmed) {
        logger.info("Deletion cancelled by user");
        return result;
      }
    }

    // STEP 6: Block if users found and no force flag
    if (userCheck.hasUsers && !forceWithUsers) {
      displayError(
        `Deletion BLOCKED - ${userCheck.userCount} user(s) found in Cognito User Pool`
      );
      logger.error("⚠️  Users will lose access if stack is deleted");
      logger.error(`Run with --force-with-users to proceed anyway`);
      result.errors.push("User check failed - users found");
      return result;
    }

    if (userCheck.hasUsers && forceWithUsers) {
      logger.warning(
        `⚠️  Proceeding with deletion despite ${userCheck.userCount} active user(s) (--force-with-users)`
      );
    }

    // STEP 7: Empty S3 buckets
    displayProgress("Emptying S3 buckets...");

    let bucketNames: string[] = [];

    if (customBuckets && customBuckets.length > 0) {
      bucketNames = customBuckets;
      logger.debug(`Using custom buckets: ${bucketNames.join(", ")}`);
    } else {
      bucketNames = await listBucketsForStack(stackName, region, logger);
      logger.debug(`Found buckets from stack outputs: ${bucketNames.join(", ")}`);
    }

    for (const bucketName of bucketNames) {
      try {
        const s3Result = await emptyS3Bucket(bucketName, region, logger);
        if (s3Result.deletedCount > 0) {
          logger.success(`Emptied ${bucketName}: ${s3Result.deletedCount} objects deleted`);
          result.bucketsEmptied.push(bucketName);
        }
        if (s3Result.errors.length > 0) {
          logger.warning(`Errors emptying ${bucketName}:`);
          s3Result.errors.forEach((err) => logger.warning(`  - ${err}`));
        }
      } catch (error: any) {
        logger.warning(`Failed to empty bucket ${bucketName}: ${error.message}`);
        result.errors.push(`S3: ${bucketName} - ${error.message}`);
      }
    }

    // STEP 8: Pre-delete hook (e.g., stop Fargate tasks, delete secrets)
    if (preDeleteHook) {
      displayProgress("Running pre-delete hook...");
      try {
        await preDeleteHook();
        logger.success("Pre-delete hook completed");
      } catch (error: any) {
        logger.warning(`Pre-delete hook failed: ${error.message}`);
        // Don't fail the whole operation
      }
    }

    // STEP 9-10: Delete CloudFormation stack
    displayProgress("Deleting CloudFormation stack...");
    try {
      await forceDeleteStack({
        stackName,
        region,
        stage,
        timeout: 30 * 60 * 1000, // 30 minutes
        logger,
      });

      result.stackDeleted = true;
      displaySuccess(`Stack ${stackName} deleted successfully`);
    } catch (error: any) {
      logger.error(`Stack deletion failed: ${error.message}`);
      result.errors.push(`Stack deletion: ${error.message}`);
      throw error;
    }

    // STEP 11: Cleanup orphaned resources
    displayProgress("Cleaning up orphaned resources...");

    const regionsToClean = [region];
    if (additionalRegions) {
      regionsToClean.push(...additionalRegions);
    }

    for (const cleanupRegion of regionsToClean) {
      try {
        logger.info(`Cleaning orphans in region: ${cleanupRegion}`);
        const cleanup = new OrphanCleanup({
          region: cleanupRegion,
          appName,
          stage,
          dryRun: false,
          logger,
        });
        await cleanup.cleanupAll();
        result.orphansCleanedUp = true;
      } catch (error: any) {
        logger.warning(`Orphan cleanup in ${cleanupRegion} had issues: ${error.message}`);
        // Don't fail the whole operation - orphan cleanup is best-effort
      }
    }

    // STEP 12: Post-delete hook (e.g., additional cleanup)
    if (postDeleteHook) {
      displayProgress("Running post-delete hook...");
      try {
        await postDeleteHook();
        logger.success("Post-delete hook completed");
      } catch (error: any) {
        logger.warning(`Post-delete hook failed: ${error.message}`);
      }
    }

    // Success!
    result.success = true;
    displaySuccess(`✓ Stack ${stackName} removed successfully`);

    if (result.retainedResources.length > 0) {
      logger.warning("Some resources were retained (manual cleanup may be required):");
      result.retainedResources.forEach((resource) => logger.warning(`  - ${resource}`));
    }

    return result;
  } catch (error: any) {
    displayError(`Stack removal failed: ${error.message}`);
    result.errors.push(error.message);
    throw error;
  }
}
