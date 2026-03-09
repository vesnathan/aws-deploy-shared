/**
 * Shared S3 Utilities
 *
 * Generic S3 operations used across deployment scripts:
 * - Upload files to S3
 * - Ensure bucket exists
 * - List objects
 * - Sync directories
 *
 * Used by ALL projects for S3 operations
 */

import { S3Client, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
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
}
