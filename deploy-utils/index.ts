/**
 * Shared Deployment Utilities
 *
 * Centralized deployment and removal functionality for all AWS deployment projects
 */

// Logger (use everywhere)
export {
  logger,
  setDebugMode,
  getDebugMode,
  resetDebugMode,
  setLogFile,
  closeLogFile,
  getLogFilePath,
} from "./logger";

// AWS Credentials
export {
  getAwsCredentials,
  validateAwsCredentials,
  configureAwsCredentials,
  getAwsAccountId,
} from "./aws-credentials";
export type { AwsCredentialsConfig } from "./aws-credentials";

// Deployment utilities
export { ResolverCompiler } from "./resolver-compiler";
export { LambdaCompiler } from "./lambda-compiler";
export { SchemaManager } from "./schema-manager";
export { BootstrapChecker } from "./bootstrap-checker";
export { FrontendDeployment } from "./frontend-deployment";
export { StackManager } from "./stack-manager";
export { S3Utils } from "./s3-utils";
export { TemplateUploader } from "./template-uploader";
export { MenuSystem } from "./menu-system";

// Main orchestrators
export { DeploymentOrchestrator } from "./deployment-orchestrator";
export { removeStack } from "./removal-orchestrator";

// Removal utilities (for advanced use cases)
export { checkCognitoUsers } from "./user-safety";
export {
  formatDeletionWarning,
  confirmDeletion,
  displayProgress,
  displayError,
  displaySuccess,
  displayWarning,
} from "./confirmation-prompts";
export { emptyS3Bucket, listBucketsForStack } from "./s3-cleanup";
export { forceDeleteStack, stackExists } from "./stack-deletion";
export { OrphanCleanup } from "./orphan-cleanup";
export { OrphanChecker } from "./orphan-checker";
export { OutputsManager } from "./outputs-manager";

// Custom Resource handlers for CloudFormation stack cleanup
export {
  s3BucketCleanupHandler,
  cognitoDomainCleanupHandler,
  route53RecordUpsertHandler,
} from "./custom-resources";

// TypeScript types
export type {
  Logger,
  UserCheckResult,
  RemovalConfig,
  DeletionOptions,
  DeletionResult,
  S3CleanupResult,
  WarningOptions,
  UserCheckOptions,
  OrphanCleanupOptions,
} from "./types";

// Deployment config types
export type { ResolverCompilerConfig } from "./resolver-compiler";
export type { LambdaCompilerConfig } from "./lambda-compiler";
export type { SchemaManagerConfig } from "./schema-manager";
export type { BootstrapCheckerConfig, BootstrapConfig, BootstrapCheckResult } from "./bootstrap-checker";
export type { FrontendDeploymentConfig } from "./frontend-deployment";
export type { StackManagerConfig } from "./stack-manager";
export type { S3UtilsConfig } from "./s3-utils";
export type { TemplateUploaderConfig } from "./template-uploader";
export type { DeployOption, MenuOption, SelectionItem, StageOption } from "./menu-system";

// CLI Arguments (for non-interactive / CI usage)
export {
  createBaseCommand,
  parseBaseOptions,
  DEFAULT_STAGES,
  isCI,
  validateNonInteractiveOptions,
} from "./cli-args";
export type { DeployAction, BaseDeployOptions, DefaultStage } from "./cli-args";
export type { DeploymentOrchestratorConfig, StackOutputs, CLIArgs } from "./deployment-orchestrator";
