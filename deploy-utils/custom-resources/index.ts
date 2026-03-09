/**
 * CloudFormation Custom Resource Handlers
 *
 * These handlers are used by CloudFormation Custom Resources to perform
 * cleanup operations during stack deletion that CloudFormation cannot
 * handle natively.
 *
 * Problem: CloudFormation cannot delete:
 * - S3 buckets that contain objects
 * - Cognito User Pools with configured domains
 *
 * Solution: Custom Resources that run cleanup Lambda functions before
 * the actual resources are deleted.
 *
 * Usage:
 * 1. Include these Lambda handlers in your project's Lambda deployment
 * 2. Use the CloudFormation template snippets to create Custom Resources
 * 3. Set DependsOn so actual resources depend on cleanup resources
 *
 * @see README.md for full integration guide
 */

export { handler as s3BucketCleanupHandler } from "./s3-bucket-cleanup";
export { handler as cognitoDomainCleanupHandler } from "./cognito-domain-cleanup";
export { handler as route53RecordUpsertHandler } from "./route53-record-upsert";
