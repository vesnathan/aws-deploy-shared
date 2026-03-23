/**
 * Shared CLI Arguments Parser
 *
 * Provides common deployment flags used across all projects.
 * Projects can extend with project-specific flags.
 *
 * Common flags:
 *   --stage <stage>      Deployment stage (dev, prod)
 *   --frontend-only      Deploy frontend only
 *   --backend-only       Deploy backend/lambdas only
 *   --resolvers-only     Deploy AppSync resolvers only
 *   --schema-only        Deploy GraphQL schema only
 *   --stack-only         Deploy CloudFormation stack only
 *   --seed               Seed database
 *   --remove             Remove/delete stack
 *   --status             Show deployment status
 *   --non-interactive    Skip menus, require all flags
 */

import { Command } from "commander";

export type DeployAction =
  | "full"
  | "frontend"
  | "backend"
  | "lambdas"
  | "resolvers"
  | "schema"
  | "stack"
  | "seed"
  | "remove"
  | "orphans"
  | "status"
  | "invalidate";

export interface BaseDeployOptions {
  stage?: string;
  action?: DeployAction;
  nonInteractive: boolean;
}

/**
 * Create a base Commander program with common deploy flags
 * Projects can extend this with additional options
 */
export function createBaseCommand(name: string, description: string): Command {
  const program = new Command();

  program
    .name(name)
    .description(description)
    .option("--stage <stage>", "Deployment stage (dev, prod)")
    .option("--frontend-only", "Deploy frontend only")
    .option("--backend-only", "Deploy backend/lambdas only")
    .option("--lambdas-only", "Deploy Lambda functions only")
    .option("--resolvers-only", "Deploy AppSync resolvers only")
    .option("--schema-only", "Deploy GraphQL schema only")
    .option("--stack-only", "Deploy CloudFormation stack only")
    .option("--seed", "Seed database with test data")
    .option("--remove", "Remove/delete the stack")
    .option("--orphans", "Check and clean orphaned resources")
    .option("--invalidate", "Invalidate CloudFront cache")
    .option("--status", "Show deployment status")
    .option("--non-interactive", "Skip interactive menus");

  return program;
}

/**
 * Parse base deploy options from Commander opts
 */
export function parseBaseOptions(opts: Record<string, unknown>): BaseDeployOptions {
  let action: DeployAction | undefined;

  if (opts.frontendOnly) action = "frontend";
  else if (opts.backendOnly || opts.lambasOnly) action = "lambdas";
  else if (opts.resolversOnly) action = "resolvers";
  else if (opts.schemaOnly) action = "schema";
  else if (opts.stackOnly) action = "stack";
  else if (opts.seed) action = "seed";
  else if (opts.remove) action = "remove";
  else if (opts.orphans) action = "orphans";
  else if (opts.invalidate) action = "invalidate";
  else if (opts.status) action = "status";

  // Non-interactive if any action flag is specified or explicit flag
  const nonInteractive = !!action || !!opts.nonInteractive;

  return {
    stage: opts.stage as string | undefined,
    action,
    nonInteractive,
  };
}

/**
 * Default stages available for deployment
 */
export const DEFAULT_STAGES = ["dev", "prod"] as const;
export type DefaultStage = (typeof DEFAULT_STAGES)[number];

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI
  );
}

/**
 * Validate that required options are present for non-interactive mode
 */
export function validateNonInteractiveOptions(
  options: BaseDeployOptions,
  requireStage: boolean = true
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (requireStage && !options.stage) {
    missing.push("--stage");
  }

  // In non-interactive mode without action, default to "full"
  // So action is not strictly required

  return {
    valid: missing.length === 0,
    missing,
  };
}
