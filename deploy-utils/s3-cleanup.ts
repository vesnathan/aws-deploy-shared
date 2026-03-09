/**
 * S3 Cleanup Utilities
 *
 * Handles S3 bucket emptying with pagination support for both
 * versioned and non-versioned buckets
 *
 * CRITICAL: CloudFormation cannot delete non-empty buckets
 * All buckets must be emptied before stack deletion
 */

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import type { S3CleanupResult, Logger } from "./types";

/**
 * Empty an S3 bucket (handles both versioned and non-versioned)
 *
 * @param bucketName Name of the S3 bucket to empty
 * @param region AWS region
 * @param logger Logger instance for progress tracking
 * @returns Result with deleted count and any errors
 */
export async function emptyS3Bucket(
  bucketName: string,
  region: string,
  logger: Logger
): Promise<S3CleanupResult> {
  const s3Client = new S3Client({ region });

  logger.info(`Emptying bucket: ${bucketName}`);

  // Check if bucket exists
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (error: any) {
    if (error.name === "NotFound" || error.name === "NoSuchBucket") {
      logger.debug(`Bucket ${bucketName} does not exist - skipping`);
      return { deletedCount: 0, errors: [] };
    }
    throw error;
  }

  const errors: string[] = [];
  let totalDeleted = 0;

  // Try versioned bucket deletion first
  try {
    const versionedResult = await emptyVersionedBucket(s3Client, bucketName, logger);
    totalDeleted += versionedResult.deletedCount;
    errors.push(...versionedResult.errors);
  } catch (error: any) {
    // If versioning not enabled, fall back to standard deletion
    logger.debug(`Bucket ${bucketName} is not versioned, using standard deletion`);
  }

  // Delete non-versioned objects
  const standardResult = await emptyStandardBucket(s3Client, bucketName, logger);
  totalDeleted += standardResult.deletedCount;
  errors.push(...standardResult.errors);

  if (totalDeleted > 0) {
    logger.success(`Deleted ${totalDeleted} objects from ${bucketName}`);
  } else {
    logger.debug(`Bucket ${bucketName} was already empty`);
  }

  return { deletedCount: totalDeleted, errors };
}

/**
 * Empty a versioned S3 bucket (delete all versions and delete markers)
 */
async function emptyVersionedBucket(
  s3Client: S3Client,
  bucketName: string,
  logger: Logger
): Promise<S3CleanupResult> {
  let deletedCount = 0;
  const errors: string[] = [];
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    const listResponse = await s3Client.send(
      new ListObjectVersionsCommand({
        Bucket: bucketName,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
        MaxKeys: 1000,
      })
    );

    const versions = listResponse.Versions || [];
    const deleteMarkers = listResponse.DeleteMarkers || [];
    const allItems = [...versions, ...deleteMarkers];

    if (allItems.length === 0) {
      break;
    }

    // Delete in batches of 1000 (AWS limit)
    const deleteObjects = allItems.map((item) => ({
      Key: item.Key!,
      VersionId: item.VersionId!,
    }));

    try {
      const deleteResponse = await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: deleteObjects,
            Quiet: true,
          },
        })
      );

      const deleted = deleteResponse.Deleted?.length || 0;
      deletedCount += deleted;

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        for (const error of deleteResponse.Errors) {
          errors.push(`${error.Key}: ${error.Message}`);
        }
      }

      logger.debug(
        `Deleted ${deleted} versioned objects from ${bucketName} (total: ${deletedCount})`
      );
    } catch (error: any) {
      errors.push(`Failed to delete batch: ${error.message}`);
    }

    keyMarker = listResponse.NextKeyMarker;
    versionIdMarker = listResponse.NextVersionIdMarker;
  } while (keyMarker);

  return { deletedCount, errors };
}

/**
 * Empty a standard (non-versioned) S3 bucket
 */
async function emptyStandardBucket(
  s3Client: S3Client,
  bucketName: string,
  logger: Logger
): Promise<S3CleanupResult> {
  let deletedCount = 0;
  const errors: string[] = [];
  let continuationToken: string | undefined;

  do {
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    const contents = listResponse.Contents || [];

    if (contents.length === 0) {
      break;
    }

    // Delete in batches of 1000 (AWS limit)
    try {
      const deleteResponse = await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: contents.map((obj) => ({ Key: obj.Key! })),
            Quiet: true,
          },
        })
      );

      const deleted = deleteResponse.Deleted?.length || 0;
      deletedCount += deleted;

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        for (const error of deleteResponse.Errors) {
          errors.push(`${error.Key}: ${error.Message}`);
        }
      }

      logger.debug(`Deleted ${deleted} objects from ${bucketName} (total: ${deletedCount})`);
    } catch (error: any) {
      errors.push(`Failed to delete batch: ${error.message}`);
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return { deletedCount, errors };
}

/**
 * Get list of S3 bucket names from CloudFormation stack outputs
 *
 * @param stackName CloudFormation stack name
 * @param region AWS region
 * @param logger Logger instance
 * @returns Array of bucket names found in stack outputs
 */
export async function listBucketsForStack(
  stackName: string,
  region: string,
  logger: Logger
): Promise<string[]> {
  const cfnClient = new CloudFormationClient({ region });

  try {
    const describeResponse = await cfnClient.send(
      new DescribeStacksCommand({ StackName: stackName })
    );

    const outputs = describeResponse.Stacks?.[0]?.Outputs || [];

    // Look for common bucket output key patterns
    const bucketKeys = [
      "WebsiteBucket",
      "FrontendBucket",
      "TemplatesBucket",
      "UserfilesBucket",
      "BackupBucket",
      "MediaBucket",
      "AssetsBucket",
      "S3Bucket",
      "BucketName",
    ];

    const buckets: string[] = [];

    for (const output of outputs) {
      // Check if output key matches known bucket patterns
      const isMatch = bucketKeys.some(
        (key) =>
          output.OutputKey?.toLowerCase().includes(key.toLowerCase()) ||
          output.OutputKey?.toLowerCase().includes("bucket")
      );

      if (isMatch && output.OutputValue) {
        buckets.push(output.OutputValue);
      }
    }

    logger.debug(`Found ${buckets.length} S3 buckets in stack ${stackName}`);

    return buckets;
  } catch (error: any) {
    if (error.message?.includes("does not exist")) {
      logger.debug(`Stack ${stackName} does not exist - no buckets to list`);
      return [];
    }
    throw error;
  }
}
