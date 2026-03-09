/**
 * CloudFormation Stack Deletion with Retry Logic
 *
 * Handles CloudFormation stack deletion with intelligent retry on failures
 * Pattern from The Story Hub's forceDeleteStack implementation
 */

import {
  CloudFormationClient,
  DeleteStackCommand,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
  type StackEvent,
} from "@aws-sdk/client-cloudformation";
import {
  SecretsManagerClient,
  DeleteSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import type { DeletionOptions, Logger } from "./types";

const POLL_INTERVAL = 10000; // 10 seconds
const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Delete a CloudFormation stack with retry logic
 *
 * If deletion fails, retries with RetainResources for failed items
 * Pre-deletes Cognito secrets that commonly cause deletion failures
 *
 * @param options Deletion configuration
 */
export async function forceDeleteStack(options: DeletionOptions): Promise<void> {
  const { stackName, region, stage, retainResources, timeout, logger } = options;

  const cfnClient = new CloudFormationClient({ region });

  logger.info(`Deleting CloudFormation stack: ${stackName}`);

  // Step 1: Pre-delete Cognito OAuth secrets (common failure point)
  await preDeleteCognitoSecrets(stackName, stage, region, logger);

  // Step 2: Attempt normal deletion
  try {
    await cfnClient.send(
      new DeleteStackCommand({
        StackName: stackName,
        RetainResources: retainResources,
      })
    );

    logger.info("Stack deletion initiated, waiting for completion...");

    // Wait for deletion to complete
    await waitForStackDeletion(cfnClient, stackName, timeout || DEFAULT_TIMEOUT, logger);

    logger.success(`Stack ${stackName} deleted successfully`);
    return;
  } catch (error: any) {
    // If deletion failed, try to identify failed resources and retry
    logger.warning(`Stack deletion encountered issues: ${error.message}`);
  }

  // Step 3: Get failed resources from stack events
  const failedResources = await getFailedResources(cfnClient, stackName, logger);

  if (failedResources.length === 0) {
    logger.error("Stack deletion failed but no failed resources identified");
    throw new Error(`Stack deletion failed: ${stackName}`);
  }

  // Step 4: Retry deletion with RetainResources
  logger.warning(
    `Retrying deletion with ${failedResources.length} resources retained...`
  );

  await cfnClient.send(
    new DeleteStackCommand({
      StackName: stackName,
      RetainResources: failedResources,
    })
  );

  await waitForStackDeletion(cfnClient, stackName, timeout || DEFAULT_TIMEOUT, logger);

  // Log retained resources for manual cleanup
  logger.warning("Stack deleted with some resources retained (manual cleanup required):");
  for (const resource of failedResources) {
    logger.warning(`  - ${resource}`);
  }

  logger.success(`Stack ${stackName} deleted (with retained resources)`);
}

/**
 * Pre-delete Cognito OAuth client secrets that often cause deletion failures
 *
 * Cognito User Pool Clients create secrets that can't be auto-deleted by CloudFormation
 */
async function preDeleteCognitoSecrets(
  stackName: string,
  stage: string,
  region: string,
  logger: Logger
): Promise<void> {
  const secretsClient = new SecretsManagerClient({ region });

  // Common Cognito OAuth secret naming patterns
  const secretPatterns = [
    `${stackName}-google-client-secret`,
    `${stackName}-oauth-secret`,
    `cognito-${stage}-google-secret`,
  ];

  for (const secretName of secretPatterns) {
    try {
      await secretsClient.send(
        new DeleteSecretCommand({
          SecretId: secretName,
          ForceDeleteWithoutRecovery: true,
        })
      );
      logger.debug(`Pre-deleted secret: ${secretName}`);
    } catch (error: any) {
      // Ignore if secret doesn't exist
      if (!error.message?.includes("ResourceNotFoundException")) {
        logger.debug(`Could not delete secret ${secretName}: ${error.message}`);
      }
    }
  }
}

/**
 * Wait for CloudFormation stack deletion to complete
 *
 * @param client CloudFormation client
 * @param stackName Stack name
 * @param timeout Timeout in milliseconds
 * @param logger Logger instance
 */
async function waitForStackDeletion(
  client: CloudFormationClient,
  stackName: string,
  timeout: number,
  logger: Logger
): Promise<void> {
  const startTime = Date.now();
  let lastStatus: string | undefined;

  while (true) {
    const elapsedTime = Date.now() - startTime;

    if (elapsedTime > timeout) {
      throw new Error(
        `Stack deletion timed out after ${timeout / 60000} minutes. ` +
        `Check AWS Console for stack status.`
      );
    }

    try {
      const response = await client.send(
        new DescribeStacksCommand({ StackName: stackName })
      );

      const stack = response.Stacks?.[0];
      const status = stack?.StackStatus;

      // Log status changes
      if (status !== lastStatus) {
        logger.info(`Stack status: ${status}`);
        lastStatus = status;
      }

      if (status === "DELETE_COMPLETE") {
        return; // Success
      }

      if (status === "DELETE_FAILED") {
        throw new Error(`Stack deletion failed with status: DELETE_FAILED`);
      }

      // Continue waiting
      await sleep(POLL_INTERVAL);
    } catch (error: any) {
      // Stack not found = deletion complete
      if (error.message?.includes("does not exist")) {
        logger.debug("Stack no longer exists - deletion complete");
        return;
      }

      throw error;
    }
  }
}

/**
 * Get list of resources that failed to delete
 *
 * @param client CloudFormation client
 * @param stackName Stack name
 * @param logger Logger instance
 * @returns Array of logical resource IDs that failed to delete
 */
async function getFailedResources(
  client: CloudFormationClient,
  stackName: string,
  logger: Logger
): Promise<string[]> {
  const failedResources: string[] = [];

  try {
    const eventsResponse = await client.send(
      new DescribeStackEventsCommand({ StackName: stackName })
    );

    const events = eventsResponse.StackEvents || [];

    // Find DELETE_FAILED events
    for (const event of events) {
      if (
        event.ResourceStatus === "DELETE_FAILED" &&
        event.LogicalResourceId &&
        event.LogicalResourceId !== stackName // Exclude stack itself
      ) {
        if (!failedResources.includes(event.LogicalResourceId)) {
          failedResources.push(event.LogicalResourceId);
          logger.debug(
            `Failed resource: ${event.LogicalResourceId} - ${event.ResourceStatusReason}`
          );
        }
      }
    }
  } catch (error: any) {
    logger.warning(`Could not retrieve failed resources: ${error.message}`);
  }

  return failedResources;
}

/**
 * Check if a CloudFormation stack exists
 *
 * @param stackName Stack name
 * @param region AWS region
 * @returns True if stack exists, false otherwise
 */
export async function stackExists(stackName: string, region: string): Promise<boolean> {
  const client = new CloudFormationClient({ region });

  try {
    await client.send(new DescribeStacksCommand({ StackName: stackName }));
    return true;
  } catch (error: any) {
    if (error.message?.includes("does not exist")) {
      return false;
    }
    throw error;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
