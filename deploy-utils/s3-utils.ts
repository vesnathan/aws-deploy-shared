/**
 * Shared S3 Utilities
 *
 * Generic S3 operations used across deployment scripts:
 * - Upload files to S3
 * - Ensure bucket exists (or create it)
 * - List objects
 * - Check object existence
 *
 * Used by ALL projects for S3 operations
 */

import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  CreateBucketCommandInput,
  GetBucketLocationCommand,
  ListObjectsV2Command,
  PutBucketVersioningCommand,
  PutPublicAccessBlockCommand,
  BucketVersioningStatus,
  BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import type { Logger } from "./types";

export interface S3UtilsConfig {
  logger: Logger;
  region: string;
}

/**
 * S3 Utilities
 *
 * Generic S3 helper functions
 */
export class S3Utils {
  private logger: Logger;
  private region: string;
  private s3Client: S3Client;

  constructor(config: S3UtilsConfig) {
    this.logger = config.logger;
    this.region = config.region;
    this.s3Client = new S3Client({ region: this.region });
  }

  /**
   * Upload file to S3
   */
  public async uploadFile(
    bucketName: string,
    key: string,
    content: string | Buffer,
    contentType: string
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
      })
    );

    this.logger.debug(`Uploaded: s3://${bucketName}/${key}`);
  }

  /**
   * Check if bucket exists
   */
  public async bucketExists(bucketName: string): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure bucket exists (throws if not)
   */
  public async ensureBucketExists(bucketName: string): Promise<void> {
    const exists = await this.bucketExists(bucketName);
    if (!exists) {
      throw new Error(
        `S3 bucket does not exist: ${bucketName}. Create it first:\n  aws s3 mb s3://${bucketName} --region ${this.region}`
      );
    }
  }

  /**
   * Ensure bucket exists, creating it if necessary
   * @returns true if bucket exists or was created successfully
   */
  public async ensureOrCreateBucket(bucketName: string): Promise<boolean> {
    try {
      this.logger.debug(`Checking if bucket ${bucketName} exists...`);

      // Check if bucket exists
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        this.logger.debug(`Bucket ${bucketName} already exists`);

        // Verify bucket region
        const locationResponse = await this.s3Client.send(
          new GetBucketLocationCommand({ Bucket: bucketName })
        );
        const bucketRegion = locationResponse.LocationConstraint || "us-east-1";
        if (
          bucketRegion !== this.region &&
          !(this.region === "us-east-1" && !locationResponse.LocationConstraint)
        ) {
          this.logger.warning(
            `Bucket ${bucketName} exists in region ${bucketRegion} instead of ${this.region}`
          );
        }
        return true;
      } catch (error: unknown) {
        const errorName = error instanceof Error ? error.name : undefined;
        if (errorName === "NotFound" || errorName === "NoSuchBucket") {
          this.logger.info(`Bucket ${bucketName} does not exist, creating...`);
        } else {
          this.logger.warning(
            `Error checking bucket: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Create bucket
      this.logger.info(`Creating bucket ${bucketName} in ${this.region}...`);

      const createParams: CreateBucketCommandInput = {
        Bucket: bucketName,
        ObjectOwnership: "BucketOwnerEnforced",
      };

      if (this.region !== "us-east-1") {
        createParams.CreateBucketConfiguration = {
          LocationConstraint: this.region as BucketLocationConstraint,
        };
      }

      try {
        await this.s3Client.send(new CreateBucketCommand(createParams));
        this.logger.success(`Bucket ${bucketName} created`);

        // Configure bucket
        await this.configureBucket(bucketName);

        // Wait for bucket to be available
        await new Promise((resolve) => setTimeout(resolve, 3000));

        return true;
      } catch (createError: unknown) {
        const errorName = createError instanceof Error ? createError.name : undefined;
        if (errorName === "BucketAlreadyOwnedByYou") {
          this.logger.success(`Bucket ${bucketName} already owned by you`);
          return true;
        }
        if (errorName === "BucketAlreadyExists") {
          this.logger.error(`Bucket ${bucketName} owned by another account`);
          return false;
        }
        throw createError;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to ensure bucket ${bucketName}: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Configure bucket with versioning and public access block
   */
  private async configureBucket(bucketName: string): Promise<void> {
    try {
      // Enable versioning
      await this.s3Client.send(
        new PutBucketVersioningCommand({
          Bucket: bucketName,
          VersioningConfiguration: {
            Status: BucketVersioningStatus.Enabled,
          },
        })
      );
      this.logger.debug(`Enabled versioning on ${bucketName}`);

      // Block public access
      await this.s3Client.send(
        new PutPublicAccessBlockCommand({
          Bucket: bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        })
      );
      this.logger.debug(`Blocked public access on ${bucketName}`);
    } catch (error: unknown) {
      this.logger.warning(
        `Failed to configure bucket ${bucketName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if object exists in bucket
   */
  public async objectExists(bucketName: string, key: string): Promise<boolean> {
    try {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: key,
          MaxKeys: 1,
        })
      );
      return !!(response.Contents?.length && response.Contents[0].Key === key);
    } catch (error: unknown) {
      this.logger.warning(
        `Error checking object ${key}: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Count objects with prefix
   */
  public async countObjectsWithPrefix(
    bucketName: string,
    prefix: string
  ): Promise<number> {
    try {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
        })
      );
      return response.Contents?.length || 0;
    } catch (error: unknown) {
      this.logger.warning(
        `Error counting objects with prefix ${prefix}: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }
}
