/**
 * Shared Template Uploader
 *
 * Uploads CloudFormation templates to S3 with content-based versioning
 * Handles nested template structure common to all projects
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Logger } from "./types";

export interface TemplateUploaderConfig {
  logger: Logger;
  deployDir: string; // Path to deploy directory
  s3BucketName: string;
  region: string;
}

/**
 * Template Uploader
 *
 * Uploads CloudFormation templates with content-based hashing
 */
export class TemplateUploader {
  private logger: Logger;
  private deployDir: string;
  private s3BucketName: string;
  private s3Client: S3Client;

  constructor(config: TemplateUploaderConfig) {
    this.logger = config.logger;
    this.deployDir = config.deployDir;
    this.s3BucketName = config.s3BucketName;
    this.s3Client = new S3Client({ region: config.region });
  }

  /**
   * Upload all CloudFormation templates to S3
   * Returns the template build hash
   */
  public async uploadTemplates(): Promise<string> {
    this.logger.info("Uploading CloudFormation templates...");

    const resourcesDir = path.join(this.deployDir, "resources");
    const dirs = fs.readdirSync(resourcesDir);
    const templateContents: string[] = [];
    const templateFiles: { dir: string; file: string; content: string }[] = [];

    // Read all nested templates
    for (const dir of dirs) {
      const dirPath = path.join(resourcesDir, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".yaml"));
        for (const file of files) {
          const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
          templateContents.push(content);
          templateFiles.push({ dir, file, content });
        }
      }
    }

    // Compute hash of all nested templates
    const templateBuildHash = crypto
      .createHash("sha256")
      .update(templateContents.join(""))
      .digest("hex")
      .substring(0, 16);

    this.logger.debug(`Template hash: ${templateBuildHash}`);

    // Upload nested templates to versioned paths (resources/${hash}/Dir/file.yaml)
    // This ensures CloudFormation detects template changes
    for (const { dir, file, content } of templateFiles) {
      const key = `resources/${templateBuildHash}/${dir}/${file}`;
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3BucketName,
          Key: key,
          Body: content,
          ContentType: "application/x-yaml",
        })
      );
      this.logger.debug(`Uploaded: ${key}`);
    }

    // Upload main template (unversioned - always at root)
    const mainTemplate = fs.readFileSync(
      path.join(this.deployDir, "cfn-template.yaml"),
      "utf-8"
    );
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: "cfn-template.yaml",
        Body: mainTemplate,
        ContentType: "application/x-yaml",
      })
    );

    this.logger.success("Templates uploaded");
    return templateBuildHash;
  }
}
