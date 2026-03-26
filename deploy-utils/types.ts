/**
 * Shared TypeScript types for AWS deployment removal utilities
 * Used across all projects for consistent removal functionality
 */

export interface Logger {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  success(message: string): void;
  debug(message: string): void;
  header(message: string): void;
}

export interface UserCheckResult {
  hasUsers: boolean;
  userCount: number;
  users: Array<{
    email: string;
    username: string;
    created: Date;
    status: string; // 'CONFIRMED' | 'UNCONFIRMED' | 'FORCE_CHANGE_PASSWORD' | 'EXTERNAL_PROVIDER'
  }>;
  userPoolId?: string;
  userPoolName?: string;
  error?: string; // If Cognito not found or query failed
  testUsersIgnored?: number; // Count of test users filtered out
  testUserEmails?: string[]; // Emails of test users that were ignored
}

export interface RemovalConfig {
  stackName: string;
  region: string;
  appName: string;
  stage: string;
  forceWithUsers?: boolean;
  skipConfirmation?: boolean;
  logger: Logger;
  // Project-specific hooks (optional)
  preDeleteHook?: () => Promise<void>; // For Fargate shutdown, etc.
  postDeleteHook?: () => Promise<void>; // For additional cleanup
  customBuckets?: string[]; // If not from stack outputs
  additionalRegions?: string[]; // For multi-region cleanup (e.g., QuizNight.Live)
  /** Regex pattern to identify test users - these won't block deletion (e.g., "^vesnathan") */
  testUserPattern?: string;
}

export interface DeletionOptions {
  stackName: string;
  region: string;
  stage: string;
  retainResources?: string[]; // For --retain-resources
  timeout?: number; // Default 30 min
  logger: Logger;
}

export interface DeletionResult {
  success: boolean;
  stackDeleted: boolean;
  bucketsEmptied: string[];
  orphansCleanedUp: boolean;
  retainedResources: string[];
  errors: string[];
}

export interface S3CleanupResult {
  deletedCount: number;
  errors: string[];
}

export interface WarningOptions {
  stackName: string;
  stage: string;
  userCheck: UserCheckResult;
  resources: string[]; // List of resource types to be deleted
  forceAllowed: boolean; // Whether --force-with-users is supported
}

export interface UserCheckOptions {
  stackName: string;
  region: string;
  stage: string;
  appName: string;
  seedRoleArn?: string; // If provided, assume this role for Cognito access
  /** Regex pattern to identify test users (e.g., "^vesnathan" matches emails starting with vesnathan) */
  testUserPattern?: string;
}

export interface OrphanCleanupOptions {
  region: string;
  appName: string;
  stage: string;
  dryRun?: boolean;
  logger: Logger;
}
