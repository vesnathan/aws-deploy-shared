/**
 * S3 Bucket Cleanup Custom Resource Handler
 *
 * CloudFormation Custom Resource that empties S3 buckets before deletion.
 * This handler is invoked during stack delete operations to allow CloudFormation
 * to successfully delete non-empty S3 buckets.
 *
 * Usage in CloudFormation:
 * - Create a Lambda function with this handler
 * - Create a Custom Resource that references the bucket
 * - CloudFormation will call this before deleting the bucket
 */

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
} from "@aws-sdk/client-s3";

interface CloudFormationCustomResourceEvent {
  RequestType: "Create" | "Update" | "Delete";
  ServiceToken: string;
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceProperties: {
    BucketName: string;
    ServiceToken: string;
  };
  OldResourceProperties?: Record<string, unknown>;
}

interface CloudFormationResponse {
  Status: "SUCCESS" | "FAILED";
  Reason?: string;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data?: Record<string, unknown>;
}

/**
 * Lambda handler for S3 bucket cleanup Custom Resource
 */
export async function handler(
  event: CloudFormationCustomResourceEvent
): Promise<void> {
  console.log("S3 Bucket Cleanup Event:", JSON.stringify(event, null, 2));

  const bucketName = event.ResourceProperties.BucketName;
  const physicalResourceId =
    event.PhysicalResourceId || `s3-cleanup-${bucketName}`;

  try {
    // Only clean up on Delete - Create and Update are no-ops
    if (event.RequestType === "Delete") {
      console.log(`Emptying bucket: ${bucketName}`);
      await emptyBucket(bucketName);
      console.log(`Successfully emptied bucket: ${bucketName}`);
    } else {
      console.log(`${event.RequestType} - no action required`);
    }

    await sendResponse(event, {
      Status: "SUCCESS",
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: { BucketName: bucketName },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);

    // For Delete, we succeed even on error to not block stack deletion
    // The bucket might already be deleted or not exist
    if (event.RequestType === "Delete") {
      console.log("Reporting SUCCESS despite error (Delete operation)");
      await sendResponse(event, {
        Status: "SUCCESS",
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Reason: `Cleanup completed with warning: ${errorMessage}`,
      });
    } else {
      await sendResponse(event, {
        Status: "FAILED",
        Reason: errorMessage,
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
      });
    }
  }
}

/**
 * Empty an S3 bucket (handles both versioned and non-versioned)
 */
async function emptyBucket(bucketName: string): Promise<void> {
  const s3Client = new S3Client({});
  let totalDeleted = 0;

  // Delete versioned objects first
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    try {
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

      if (allItems.length > 0) {
        const deleteObjects = allItems.map((item) => ({
          Key: item.Key!,
          VersionId: item.VersionId,
        }));

        const deleteResponse = await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: deleteObjects,
              Quiet: true,
            },
          })
        );

        totalDeleted += deleteResponse.Deleted?.length || 0;

        if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          console.warn(
            "Delete errors:",
            JSON.stringify(deleteResponse.Errors, null, 2)
          );
        }
      }

      keyMarker = listResponse.NextKeyMarker;
      versionIdMarker = listResponse.NextVersionIdMarker;
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      // If versioning isn't enabled, we'll get an error - that's OK
      if (err.name === "NoSuchBucket") {
        console.log("Bucket does not exist - nothing to clean");
        return;
      }
      console.log("Versioned listing failed, trying standard listing");
      break;
    }
  } while (keyMarker);

  // Delete non-versioned objects
  let continuationToken: string | undefined;

  do {
    try {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      );

      const contents = listResponse.Contents || [];

      if (contents.length > 0) {
        const deleteResponse = await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: contents.map((obj) => ({ Key: obj.Key! })),
              Quiet: true,
            },
          })
        );

        totalDeleted += deleteResponse.Deleted?.length || 0;
      }

      continuationToken = listResponse.NextContinuationToken;
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === "NoSuchBucket") {
        console.log("Bucket does not exist - nothing to clean");
        return;
      }
      throw error;
    }
  } while (continuationToken);

  console.log(`Deleted ${totalDeleted} objects from ${bucketName}`);
}

/**
 * Send response to CloudFormation
 */
async function sendResponse(
  event: CloudFormationCustomResourceEvent,
  response: CloudFormationResponse
): Promise<void> {
  const responseBody = JSON.stringify(response);

  console.log("Sending response:", responseBody);

  const parsedUrl = new URL(event.ResponseURL);

  const requestOptions: RequestInit = {
    method: "PUT",
    body: responseBody,
    headers: {
      "Content-Type": "",
      "Content-Length": String(Buffer.byteLength(responseBody)),
    },
  };

  try {
    const fetchResponse = await fetch(parsedUrl.toString(), requestOptions);
    console.log(`Response status: ${fetchResponse.status}`);
  } catch (error) {
    console.error("Error sending response:", error);
    throw error;
  }
}
