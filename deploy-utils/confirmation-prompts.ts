/**
 * Confirmation Prompts and ASCII Warnings
 *
 * Provides consistent warning displays and type-to-confirm confirmations
 * across all deployment removal operations
 */

import * as readline from "readline";
import type { WarningOptions } from "./types";

/**
 * Format a deletion warning with ASCII box and user details
 *
 * @param options Warning display options
 * @returns Formatted warning string for console output
 */
export function formatDeletionWarning(options: WarningOptions): string {
  const { stackName, stage, userCheck, resources, forceAllowed } = options;

  const lines: string[] = [];

  // Header
  if (userCheck.hasUsers) {
    lines.push("");
    lines.push("⚠️  CRITICAL: USERS WILL LOSE ACCESS");
  } else {
    lines.push("");
    lines.push("⚠️  WARNING: DELETION CANNOT BE UNDONE");
  }

  lines.push("━".repeat(50));
  lines.push("");

  // Stack details
  lines.push(`Stack: ${stackName}`);
  lines.push(`Stage: ${stage}`);
  lines.push("");

  // User information
  if (userCheck.hasUsers) {
    lines.push(`USERS FOUND: ${userCheck.userCount} active user${userCheck.userCount > 1 ? "s" : ""}`);
    lines.push("");

    for (const user of userCheck.users) {
      const createdDate = new Date(user.created).toLocaleDateString();
      lines.push(`  • ${user.email} (${user.status}, created ${createdDate})`);
    }

    lines.push("");
  } else if (userCheck.error?.includes("No Cognito")) {
    lines.push("No Cognito User Pool found - skipping user check");
    lines.push("");
  }

  // Resources to be deleted
  if (resources.length > 0) {
    lines.push("RESOURCES TO BE DELETED:");
    for (const resource of resources) {
      lines.push(`  - ${resource}`);
    }
    lines.push("");
  }

  // Warning for users
  if (userCheck.hasUsers) {
    lines.push("⚠️  Deletion BLOCKED");
    lines.push("");
    lines.push("These users will permanently lose access.");
    lines.push("All user data will be deleted.");
    lines.push("");

    if (forceAllowed) {
      lines.push("To proceed anyway, run:");
      lines.push(`  yarn deploy --remove --stage ${stage} --force-with-users`);
    } else {
      lines.push("Cannot proceed with active users.");
    }
  } else {
    lines.push("⚠️  All data will be permanently deleted");
  }

  lines.push("");
  lines.push("━".repeat(50));

  return lines.join("\n");
}

/**
 * Prompt user to confirm deletion by typing the stack name
 *
 * @param stackName Name of stack to be deleted
 * @param skipConfirm If true, skip confirmation (for -y flag)
 * @returns Promise<boolean> True if confirmed, false otherwise
 */
export async function confirmDeletion(
  stackName: string,
  skipConfirm: boolean = false
): Promise<boolean> {
  if (skipConfirm) {
    return true;
  }

  console.log("");
  console.log(`To confirm deletion, type the stack name: ${stackName}`);
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Stack name: ", (answer) => {
      rl.close();

      if (answer.trim() === stackName) {
        console.log("");
        console.log("✓ Confirmed - proceeding with deletion");
        console.log("");
        resolve(true);
      } else {
        console.log("");
        console.log("✗ Stack name does not match - deletion cancelled");
        console.log("");
        resolve(false);
      }
    });
  });
}

/**
 * Display a simple progress message with consistent formatting
 */
export function displayProgress(message: string): void {
  console.log(`\n▶ ${message}\n`);
}

/**
 * Display an error message with consistent formatting
 */
export function displayError(message: string): void {
  console.error(`\n✗ ERROR: ${message}\n`);
}

/**
 * Display a success message with consistent formatting
 */
export function displaySuccess(message: string): void {
  console.log(`\n✓ ${message}\n`);
}

/**
 * Display a warning message with consistent formatting
 */
export function displayWarning(message: string): void {
  console.warn(`\n⚠  ${message}\n`);
}
