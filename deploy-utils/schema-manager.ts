/**
 * Shared Schema Manager
 *
 * Manages GraphQL schema files for AppSync:
 * - Merges multiple .graphql schema files into one
 * - Computes content hash for versioning
 * - Uploads to S3
 * - Writes local copy for reference
 *
 * Used by ALL projects with AppSync GraphQL APIs
 */

import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Logger } from "./types";

export interface SchemaManagerConfig {
  logger: Logger;
  projectRoot: string; // Path to project root
  region: string; // AWS region
  s3BucketName: string; // Template bucket name
  s3KeyPrefix?: string; // S3 key prefix (default: "schema")
}

/**
 * Schema Manager
 *
 * Merges and uploads GraphQL schema files
 */
export class SchemaManager {
  private logger: Logger;
  private projectRoot: string;
  private region: string;
  private s3BucketName: string;
  private s3KeyPrefix: string;
  private s3Client: S3Client;

  constructor(config: SchemaManagerConfig) {
    this.logger = config.logger;
    this.projectRoot = config.projectRoot;
    this.region = config.region;
    this.s3BucketName = config.s3BucketName;
    this.s3KeyPrefix = config.s3KeyPrefix || "schema";
    this.s3Client = new S3Client({ region: this.region });
  }

  /**
   * Merge all .graphql files in backend/schema directory
   */
  private mergeSchemaFiles(): string {
    const schemaDir = path.join(this.projectRoot, "backend", "schema");

    if (!fs.existsSync(schemaDir)) {
      throw new Error(`Schema directory not found: ${schemaDir}`);
    }

    const schemaFiles = fs
      .readdirSync(schemaDir)
      .filter((f) => f.endsWith(".graphql"))
      .sort(); // Alphabetical order for consistent merging

    if (schemaFiles.length === 0) {
      throw new Error(`No .graphql files found in ${schemaDir}`);
    }

    this.logger.debug(`Found ${schemaFiles.length} schema files`);

    const mergedSchema: string[] = [];

    for (const file of schemaFiles) {
      const filePath = path.join(schemaDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      mergedSchema.push(`# From: ${file}`);
      mergedSchema.push(content.trim());
      mergedSchema.push(""); // Blank line between files
    }

    return mergedSchema.join("\n");
  }

  /**
   * Compute content hash of schema
   */
  private computeSchemaHash(schema: string): string {
    return crypto.createHash("sha256").update(schema).digest("hex").slice(0, 16);
  }

  /**
   * Upload schema to S3
   *
   * Path format: {prefix}/{hash}/schema.graphql
   * This matches what CloudFormation expects for DefinitionS3Location
   */
  private async uploadSchemaToS3(schema: string, hash: string): Promise<string> {
    const s3Key = path.posix.join(this.s3KeyPrefix, hash, "schema.graphql");

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: s3Key,
        Body: schema,
        ContentType: "text/plain",
      })
    );

    return s3Key;
  }

  /**
   * Write local copy of merged schema for reference
   */
  private writeLocalCopy(schema: string): void {
    const localPath = path.join(this.projectRoot, "backend", "combined_schema.graphql");
    fs.writeFileSync(localPath, schema);
    this.logger.debug(`Written local copy: backend/combined_schema.graphql`);
  }

  /**
   * Merge schema files and upload to S3
   *
   * @returns Schema build hash (used in CloudFormation parameters)
   */
  public async mergeAndUploadSchema(): Promise<string> {
    this.logger.info("Merging GraphQL schema files...");

    const mergedSchema = this.mergeSchemaFiles();
    const schemaHash = this.computeSchemaHash(mergedSchema);

    this.logger.info(`Schema hash: ${schemaHash}`);

    const s3Key = await this.uploadSchemaToS3(mergedSchema, schemaHash);
    this.logger.success(`Uploaded: ${s3Key}`);

    this.writeLocalCopy(mergedSchema);

    return schemaHash;
  }
}
