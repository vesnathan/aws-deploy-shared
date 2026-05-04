/**
 * Shared Stack Manager
 *
 * Manages CloudFormation stack operations:
 * - Check if stack exists
 * - Create stack
 * - Update stack
 * - Get stack outputs
 * - Wait for stack completion
 * - Handle "no updates" gracefully
 *
 * Used by ALL projects for CloudFormation deployment
 */

import {
  CloudFormationClient,
  CreateStackCommand,
  UpdateStackCommand,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
  type Stack,
  type StackEvent,
  type Capability,
} from "@aws-sdk/client-cloudformation";
import type { Logger } from "./types";

export interface StackManagerConfig {
  logger: Logger;
  stackName: string;
  region: string;
  templateUrl: string; // S3 URL to CloudFormation template
  parameters: Array<{ ParameterKey: string; ParameterValue: string }>;
  cfnRoleArn: string; // CloudFormation service role ARN
  capabilities?: Capability[]; // Default: ["CAPABILITY_NAMED_IAM"]
  disableRollback?: boolean; // Default: true for create
}

/**
 * CloudFormation Stack Status Categories
 *
 * READY: Stack can be updated/created
 * TRANSITIONAL: Stack is busy, wait for it to complete
 * FAILED: Stack is in a failed state, needs manual intervention
 * NOT_FOUND: Stack doesn't exist
 */
type StackStateCategory = "READY" | "TRANSITIONAL" | "FAILED" | "NOT_FOUND";

/**
 * All possible CloudFormation stack statuses grouped by category
 */
const STACK_STATUS_CATEGORIES: Record<string, StackStateCategory> = {
  // Ready states - can proceed with update/create
  CREATE_COMPLETE: "READY",
  UPDATE_COMPLETE: "READY",
  UPDATE_ROLLBACK_COMPLETE: "READY",
  IMPORT_COMPLETE: "READY",
  IMPORT_ROLLBACK_COMPLETE: "READY",

  // Transitional states - wait for completion
  CREATE_IN_PROGRESS: "TRANSITIONAL",
  DELETE_IN_PROGRESS: "TRANSITIONAL",
  UPDATE_IN_PROGRESS: "TRANSITIONAL",
  UPDATE_COMPLETE_CLEANUP_IN_PROGRESS: "TRANSITIONAL",
  UPDATE_ROLLBACK_IN_PROGRESS: "TRANSITIONAL",
  UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS: "TRANSITIONAL",
  ROLLBACK_IN_PROGRESS: "TRANSITIONAL",
  DELETE_COMPLETE: "TRANSITIONAL", // Treat as transitional - stack is being deleted
  IMPORT_IN_PROGRESS: "TRANSITIONAL",
  IMPORT_ROLLBACK_IN_PROGRESS: "TRANSITIONAL",

  // Failed states - need manual intervention
  CREATE_FAILED: "FAILED",
  DELETE_FAILED: "FAILED",
  ROLLBACK_COMPLETE: "FAILED",
  ROLLBACK_FAILED: "FAILED",
  UPDATE_FAILED: "FAILED",
};

/**
 * Stack Manager
 *
 * Manages CloudFormation stack lifecycle
 */
export class StackManager {
  private logger: Logger;
  private stackName: string;
  private region: string;
  private templateUrl: string;
  private parameters: Array<{ ParameterKey: string; ParameterValue: string }>;
  private cfnRoleArn: string;
  private capabilities: Capability[];
  private disableRollback: boolean;
  private cfnClient: CloudFormationClient;

  constructor(config: StackManagerConfig) {
    this.logger = config.logger;
    this.stackName = config.stackName;
    this.region = config.region;
    this.templateUrl = config.templateUrl;
    this.parameters = config.parameters;
    this.cfnRoleArn = config.cfnRoleArn;
    this.capabilities = config.capabilities || ["CAPABILITY_NAMED_IAM" as Capability];
    this.disableRollback = config.disableRollback ?? true;
    this.cfnClient = new CloudFormationClient({ region: this.region });
  }

  /**
   * Get the category of a stack status
   */
  private getStatusCategory(status: string): StackStateCategory {
    return STACK_STATUS_CATEGORIES[status] || "FAILED";
  }

  /**
   * Get human-readable description of what's happening for a transitional state
   */
  private getTransitionalStateMessage(status: string): string {
    const messages: Record<string, string> = {
      CREATE_IN_PROGRESS: "Stack is being created",
      DELETE_IN_PROGRESS: "Stack is being deleted",
      UPDATE_IN_PROGRESS: "Stack update is in progress",
      UPDATE_COMPLETE_CLEANUP_IN_PROGRESS: "Stack update completing, cleaning up old resources",
      UPDATE_ROLLBACK_IN_PROGRESS: "Stack update failed, rolling back changes",
      UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS: "Rollback complete, cleaning up resources",
      ROLLBACK_IN_PROGRESS: "Stack creation failed, rolling back",
      DELETE_COMPLETE: "Stack has been deleted",
      IMPORT_IN_PROGRESS: "Stack import in progress",
      IMPORT_ROLLBACK_IN_PROGRESS: "Stack import failed, rolling back",
    };
    return messages[status] || `Stack is in ${status} state`;
  }

  /**
   * Get human-readable error message for a failed state
   */
  private getFailedStateMessage(status: string): string {
    const messages: Record<string, string> = {
      CREATE_FAILED: "Stack creation failed. Delete the stack and try again.",
      DELETE_FAILED: "Stack deletion failed. Check for resources that couldn't be deleted.",
      ROLLBACK_COMPLETE: "Stack creation failed and rolled back. Delete the stack and try again.",
      ROLLBACK_FAILED: "Stack rollback failed. Manual cleanup may be required.",
      UPDATE_FAILED: "Stack update failed. Check stack events for details.",
    };
    return messages[status] || `Stack is in ${status} state and cannot be updated.`;
  }

  /**
   * Wait for a stack in a transitional state to reach a stable state
   */
  public async waitForStackReady(maxWaitTime: number = 600): Promise<"READY" | "NOT_FOUND"> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (true) {
      const elapsed = Date.now() - startTime;
      const elapsedStr = this.formatElapsed(elapsed);

      if (elapsed > maxWaitTime * 1000) {
        throw new Error(
          `Timed out waiting for stack to be ready after ${elapsedStr}`
        );
      }

      // Get current stack status
      let stack: Stack | null = null;
      try {
        const response = await this.cfnClient.send(
          new DescribeStacksCommand({ StackName: this.stackName })
        );
        stack = response.Stacks?.[0] || null;
      } catch (error: unknown) {
        if (error instanceof Error && error.message?.includes("does not exist")) {
          return "NOT_FOUND";
        }
        throw error;
      }

      if (!stack || !stack.StackStatus) {
        return "NOT_FOUND";
      }

      const status = stack.StackStatus;
      const category = this.getStatusCategory(status);

      // Handle DELETE_COMPLETE specially - stack is gone
      if (status === "DELETE_COMPLETE") {
        return "NOT_FOUND";
      }

      if (category === "READY") {
        // Clear the progress line
        process.stdout.write("\r\x1b[K");
        return "READY";
      }

      if (category === "FAILED") {
        // Clear the progress line
        process.stdout.write("\r\x1b[K");
        const message = this.getFailedStateMessage(status);
        throw new Error(`Stack ${this.stackName}: ${message}`);
      }

      // Transitional - show progress and wait
      const stateMessage = this.getTransitionalStateMessage(status);
      process.stdout.write(
        `\r\x1b[K[${elapsedStr}] ${stateMessage}... waiting`
      );

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Check if stack exists and is in a valid state
   * Waits for transitional states to complete
   */
  public async stackExists(): Promise<boolean> {
    try {
      const response = await this.cfnClient.send(
        new DescribeStacksCommand({ StackName: this.stackName })
      );

      const stack = response.Stacks?.[0];
      if (!stack || !stack.StackStatus) {
        return false;
      }

      const status = stack.StackStatus;
      const category = this.getStatusCategory(status);

      // Handle DELETE_COMPLETE - stack is gone
      if (status === "DELETE_COMPLETE") {
        return false;
      }

      // If transitional, wait for it to complete
      if (category === "TRANSITIONAL") {
        this.logger.info(
          `Stack is in ${status} state. Waiting for it to complete...`
        );
        const result = await this.waitForStackReady();
        return result === "READY";
      }

      // If failed, throw with helpful message
      if (category === "FAILED") {
        const message = this.getFailedStateMessage(status);
        this.logger.warning(`Stack ${this.stackName} is in ${status} state.`);
        this.logger.warning(message);
        throw new Error(
          `Stack ${this.stackName} is in ${status} state and cannot be updated`
        );
      }

      // READY state
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("does not exist")) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get stack outputs
   */
  public async getStackOutputs(): Promise<Record<string, string>> {
    const response = await this.cfnClient.send(
      new DescribeStacksCommand({ StackName: this.stackName })
    );
    const outputs: Record<string, string> = {};

    for (const output of response.Stacks?.[0]?.Outputs || []) {
      if (output.OutputKey && output.OutputValue) {
        outputs[output.OutputKey] = output.OutputValue;
      }
    }

    return outputs;
  }

  /**
   * Get full stack details
   */
  public async getStack(): Promise<Stack | null> {
    try {
      const response = await this.cfnClient.send(
        new DescribeStacksCommand({ StackName: this.stackName })
      );
      return response.Stacks?.[0] || null;
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("does not exist")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Format elapsed time as human-readable string
   */
  private formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Wait for stack operation with progress indicators
   */
  private async waitForStackWithProgress(
    operation: "CREATE" | "UPDATE",
    // 60 min — Cognito custom-domain teardown alone can take 20–60 min
    // because CloudFront has to drain. The old 15-min default reported
    // false-positive timeouts on otherwise-healthy deploys.
    maxWaitTime: number = 3600
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds
    const seenEventIds = new Set<string>();
    let lastResourceUpdate = "";

    // Get initial events to mark as "seen"
    try {
      const initialEvents = await this.cfnClient.send(
        new DescribeStackEventsCommand({ StackName: this.stackName })
      );
      for (const event of initialEvents.StackEvents || []) {
        if (event.EventId) {
          seenEventIds.add(event.EventId);
        }
      }
    } catch {
      // Ignore - stack might not have events yet
    }

    const inProgressStatuses = [
      `${operation}_IN_PROGRESS`,
      "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
      "UPDATE_ROLLBACK_IN_PROGRESS",
      "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
      "CREATE_IN_PROGRESS",
      "DELETE_IN_PROGRESS",
    ];

    const successStatuses = [
      `${operation}_COMPLETE`,
      "UPDATE_COMPLETE",
      "CREATE_COMPLETE",
    ];

    const failureStatuses = [
      `${operation}_FAILED`,
      `${operation}_ROLLBACK_COMPLETE`,
      `${operation}_ROLLBACK_FAILED`,
      "ROLLBACK_COMPLETE",
      "ROLLBACK_FAILED",
      "DELETE_FAILED",
    ];

    while (true) {
      const elapsed = Date.now() - startTime;

      if (elapsed > maxWaitTime * 1000) {
        throw new Error(
          `Stack ${operation.toLowerCase()} timed out after ${this.formatElapsed(elapsed)}`
        );
      }

      // Get stack status
      const stackResponse = await this.cfnClient.send(
        new DescribeStacksCommand({ StackName: this.stackName })
      );
      const stack = stackResponse.Stacks?.[0];
      const status = stack?.StackStatus || "UNKNOWN";

      // Get recent events for progress
      try {
        const eventsResponse = await this.cfnClient.send(
          new DescribeStackEventsCommand({ StackName: this.stackName })
        );

        const newEvents: StackEvent[] = [];
        for (const event of eventsResponse.StackEvents || []) {
          if (event.EventId && !seenEventIds.has(event.EventId)) {
            seenEventIds.add(event.EventId);
            newEvents.push(event);
          }
        }

        // Show new events (most recent first, so reverse)
        if (newEvents.length > 0) {
          // Clear progress line before printing events
          process.stdout.write("\r\x1b[K");
        }

        for (const event of newEvents.reverse()) {
          const resource = event.LogicalResourceId || "Unknown";
          const resourceStatus = event.ResourceStatus || "UNKNOWN";
          const reason = event.ResourceStatusReason || "";

          // Skip stack-level events, show resource events
          if (resource !== this.stackName) {
            const statusIcon = resourceStatus.includes("COMPLETE")
              ? "✓"
              : resourceStatus.includes("FAILED")
                ? "✗"
                : resourceStatus.includes("IN_PROGRESS")
                  ? "⋯"
                  : "?";

            const shortStatus = resourceStatus
              .replace("_IN_PROGRESS", "")
              .replace("_COMPLETE", "")
              .replace("_FAILED", "");

            if (resourceStatus.includes("FAILED") && reason) {
              this.logger.error(
                `  ${statusIcon} ${resource}: ${shortStatus} - ${reason}`
              );
            } else if (resourceStatus.includes("IN_PROGRESS")) {
              lastResourceUpdate = resource;
              this.logger.info(
                `  ${statusIcon} ${resource}: ${shortStatus}...`
              );
            } else if (resourceStatus.includes("COMPLETE")) {
              this.logger.debug(`  ${statusIcon} ${resource}: ${shortStatus}`);
            }
          }
        }
      } catch {
        // Events might not be available yet
      }

      // Log progress with elapsed time (updates in place)
      const elapsedStr = this.formatElapsed(elapsed);
      const resourceInfo = lastResourceUpdate
        ? ` (${lastResourceUpdate})`
        : "";

      process.stdout.write(
        `\r\x1b[K[${elapsedStr}] Stack status: ${status}${resourceInfo}`
      );

      // Check for completion
      if (successStatuses.includes(status)) {
        console.log(""); // New line after progress
        return;
      }

      if (failureStatuses.includes(status)) {
        console.log(""); // New line after progress
        const reason = stack?.StackStatusReason || "Unknown reason";
        throw new Error(`Stack ${operation.toLowerCase()} failed: ${reason}`);
      }

      if (!inProgressStatuses.includes(status)) {
        // Unexpected status - might be transitioning, wait a bit
        this.logger.debug(`Unexpected status: ${status}, waiting...`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Deploy stack (create or update)
   */
  public async deployStack(): Promise<void> {
    this.logger.info("Deploying CloudFormation stack...");

    const exists = await this.stackExists();

    try {
      if (exists) {
        this.logger.info(`Updating stack: ${this.stackName}`);
        this.logger.debug(`Using CFN Role: ${this.cfnRoleArn}`);

        await this.cfnClient.send(
          new UpdateStackCommand({
            StackName: this.stackName,
            TemplateURL: this.templateUrl,
            Parameters: this.parameters,
            Capabilities: this.capabilities,
            RoleARN: this.cfnRoleArn,
          })
        );

        await this.waitForStackWithProgress("UPDATE");
      } else {
        this.logger.info(`Creating stack: ${this.stackName}`);
        this.logger.debug(`Using CFN Role: ${this.cfnRoleArn}`);

        await this.cfnClient.send(
          new CreateStackCommand({
            StackName: this.stackName,
            TemplateURL: this.templateUrl,
            Parameters: this.parameters,
            Capabilities: this.capabilities,
            RoleARN: this.cfnRoleArn,
            DisableRollback: this.disableRollback,
          })
        );

        await this.waitForStackWithProgress("CREATE");
      }

      this.logger.success("Stack deployment complete!");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message?.includes("No updates are to be performed")
      ) {
        this.logger.info("No infrastructure updates needed");
      } else {
        throw error;
      }
    }
  }
}
