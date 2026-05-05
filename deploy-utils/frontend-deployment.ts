/**
 * Shared Frontend Deployment
 *
 * Handles frontend deployment for Next.js static exports:
 * - Passes NEXT_PUBLIC_* env vars directly to build process (industry standard)
 * - Builds Next.js frontend (yarn build)
 * - Uploads to S3
 * - Invalidates CloudFront cache
 *
 * NOTE: Environment variables are passed inline to the build command,
 * NOT written to .env.local. This preserves developers' local configs
 * and follows CI/CD best practices.
 *
 * Used by ALL projects with Next.js frontends
 */

import * as path from "path";
import * as fs from "fs";
import { spawnSync } from "child_process";
import * as mimeTypes from "mime-types";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
  waitUntilInvalidationCompleted,
} from "@aws-sdk/client-cloudfront";
import {
  STSClient,
  AssumeRoleCommand,
} from "@aws-sdk/client-sts";
import type { Logger } from "./types";

export interface FrontendDeploymentConfig {
  logger: Logger;
  projectRoot: string; // Path to project root
  appName: string; // e.g., "helpstay"
  stage: string; // e.g., "dev", "prod"
  region: string; // AWS region
  stackOutputs: Record<string, string>; // CloudFormation stack outputs
  frontendUrl?: string; // Override for NEXT_PUBLIC_FRONTEND_URL (e.g., custom domain)
  envVars?: Record<string, string>; // Additional NEXT_PUBLIC_* env vars (non-public vars are filtered out)
  buildCommand?: string; // Default: "yarn build"
}

/**
 * Frontend Deployment Manager
 *
 * Builds and deploys Next.js frontend to S3/CloudFront
 */
export class FrontendDeployment {
  private logger: Logger;
  private projectRoot: string;
  private appName: string;
  private stage: string;
  private region: string;
  private stackOutputs: Record<string, string>;
  private frontendUrl: string;
  private envVars: Record<string, string>;
  private buildCommand: string;
  private stsClient: STSClient;

  constructor(config: FrontendDeploymentConfig) {
    this.logger = config.logger;
    this.projectRoot = config.projectRoot;
    this.appName = config.appName;
    this.stage = config.stage;
    this.region = config.region;
    this.stackOutputs = config.stackOutputs;
    this.frontendUrl = config.frontendUrl || `https://${config.stackOutputs.CloudFrontDomainName || ""}`;
    this.envVars = config.envVars || {};
    this.buildCommand = config.buildCommand || "yarn build";
    this.stsClient = new STSClient({ region: this.region });
  }

  /**
   * Build environment variables object for the frontend build.
   * Only includes NEXT_PUBLIC_* vars (safe for client-side).
   * These are passed directly to the build process, not written to files.
   */
  private getBuildEnvVars(): Record<string, string> {
    // Disable debug logging for prod/staging (overrides local .env files)
    const isProduction = this.stage === "prod" || this.stage === "staging";

    const buildEnv: Record<string, string> = {
      NEXT_PUBLIC_AWS_REGION: this.region,
      NEXT_PUBLIC_USER_POOL_ID: this.stackOutputs.UserPoolId || "",
      NEXT_PUBLIC_USER_POOL_CLIENT_ID: this.stackOutputs.UserPoolClientId || "",
      NEXT_PUBLIC_IDENTITY_POOL_ID: this.stackOutputs.IdentityPoolId || "",
      NEXT_PUBLIC_GRAPHQL_API_ENDPOINT: this.stackOutputs.ApiUrl || "",
      NEXT_PUBLIC_COGNITO_DOMAIN: this.stackOutputs.CognitoDomain || "",
      NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: this.stackOutputs.GoogleOAuthEnabled || "false",
      NEXT_PUBLIC_FRONTEND_URL: this.frontendUrl,
      NEXT_PUBLIC_DEBUG_MODE: isProduction ? "false" : "true",
    };

    // Add additional env vars, but only NEXT_PUBLIC_* ones (safety filter)
    for (const [key, value] of Object.entries(this.envVars)) {
      if (key.startsWith("NEXT_PUBLIC_")) {
        buildEnv[key] = value;
      } else {
        this.logger.warning(`Skipping non-public env var: ${key} (must start with NEXT_PUBLIC_)`);
      }
    }

    return buildEnv;
  }

  /**
   * Build frontend with yarn build
   * Environment variables are passed directly to the build process,
   * not written to .env.local (preserves developer's local config)
   */
  public async buildFrontend(): Promise<void> {
    this.logger.info("Building frontend...");

    const frontendDir = path.join(this.projectRoot, "frontend");
    const buildEnv = this.getBuildEnvVars();

    this.logger.debug(`Build environment variables: ${Object.keys(buildEnv).join(", ")}`);

    // Pass env vars directly to the build process
    // This follows industry best practice and doesn't clobber .env.local
    const result = spawnSync(this.buildCommand, {
      cwd: frontendDir,
      stdio: ["inherit", "pipe", "inherit"],
      shell: true,
      env: {
        ...process.env,  // Inherit system env (PATH, etc.)
        ...buildEnv,     // Override with build-specific NEXT_PUBLIC_* vars
      },
    });

    if (result.status !== 0) {
      throw new Error(`Frontend build failed with exit code ${result.status}`);
    }

    this.logger.success("Frontend build complete");
  }

  /**
   * Count files in directory recursively
   */
  private countFiles(dir: string): number {
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += this.countFiles(path.join(dir, entry.name));
      } else {
        count++;
      }
    }
    return count;
  }

  /**
   * Collect all files in directory recursively
   */
  private collectFiles(
    localDir: string,
    prefix: string = ""
  ): Array<{ fullPath: string; key: string }> {
    const files: Array<{ fullPath: string; key: string }> = [];
    const entries = fs.readdirSync(localDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(localDir, entry.name);
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        files.push(...this.collectFiles(fullPath, key));
      } else {
        files.push({ fullPath, key });
      }
    }
    return files;
  }

  /**
   * List all objects in S3 bucket
   */
  private async listAllObjects(
    s3Client: S3Client,
    bucket: string
  ): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        })
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            keys.push(obj.Key);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }

  /**
   * Delete stale files from S3 that are not in the new build
   */
  private async deleteStaleFiles(
    s3Client: S3Client,
    bucket: string,
    localKeys: Set<string>
  ): Promise<number> {
    const existingKeys = await this.listAllObjects(s3Client, bucket);
    const keysToDelete = existingKeys.filter((key) => !localKeys.has(key));

    if (keysToDelete.length === 0) {
      return 0;
    }

    // Delete in batches of 1000 (S3 limit)
    const batchSize = 1000;
    for (let i = 0; i < keysToDelete.length; i += batchSize) {
      const batch = keysToDelete.slice(i, i + batchSize);
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: true,
          },
        })
      );
    }

    return keysToDelete.length;
  }

  /**
   * Upload directory to S3 with progress
   */
  private async uploadDir(
    s3Client: S3Client,
    bucket: string,
    localDir: string
  ): Promise<void> {
    const files = this.collectFiles(localDir);
    const totalFiles = files.length;
    let uploadedCount = 0;
    const startTime = Date.now();

    // Upload in batches for better performance
    const batchSize = 10;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ({ fullPath, key }) => {
          const content = fs.readFileSync(fullPath);
          const contentType =
            mimeTypes.lookup(path.basename(fullPath)) || "application/octet-stream";
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: content,
              ContentType: contentType,
            })
          );
        })
      );

      uploadedCount += batch.length;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const percent = Math.round((uploadedCount / totalFiles) * 100);
      process.stdout.write(
        `\r  Uploading: ${uploadedCount}/${totalFiles} files (${percent}%) [${elapsed}s]`
      );
    }

    console.log(""); // New line after progress
  }

  /**
   * Deploy frontend to S3 and invalidate CloudFront cache
   */
  public async deployFrontend(): Promise<void> {
    this.logger.info("Deploying frontend to S3...");

    const frontendDir = path.join(this.projectRoot, "frontend");
    const outDir = path.join(frontendDir, "out");

    if (!fs.existsSync(outDir)) {
      throw new Error("Frontend build output not found. Run build first.");
    }

    const seedRoleArn = this.stackOutputs.SeedRoleArn;
    if (!seedRoleArn) {
      throw new Error(
        "SeedRoleArn not found in stack outputs. Make sure DeployUserArn is set."
      );
    }

    this.logger.debug("Assuming seed role for deployment...");
    const assumeRoleResponse = await this.stsClient.send(
      new AssumeRoleCommand({
        RoleArn: seedRoleArn,
        RoleSessionName: "deploy-frontend",
        ExternalId: `${this.appName}-seed-${this.stage}`,
        DurationSeconds: 3600,
      })
    );

    const credentials = assumeRoleResponse.Credentials!;

    const seedS3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: credentials.AccessKeyId!,
        secretAccessKey: credentials.SecretAccessKey!,
        sessionToken: credentials.SessionToken!,
      },
    });

    const seedCfClient = new CloudFrontClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.AccessKeyId!,
        secretAccessKey: credentials.SecretAccessKey!,
        sessionToken: credentials.SessionToken!,
      },
    });

    const bucket = this.stackOutputs.WebsiteBucket!;

    // Collect local file keys for stale file cleanup
    const localFiles = this.collectFiles(outDir);
    const localKeys = new Set(localFiles.map((f) => f.key));

    await this.uploadDir(seedS3Client, bucket, outDir);
    this.logger.success("Frontend uploaded to S3");

    // Delete stale files that are no longer in the build
    this.logger.info("Cleaning up stale files...");
    const deletedCount = await this.deleteStaleFiles(seedS3Client, bucket, localKeys);
    if (deletedCount > 0) {
      this.logger.debug(`Deleted ${deletedCount} stale files`);
    }

    this.logger.info("Invalidating CloudFront cache...");
    const invalidation = await seedCfClient.send(
      new CreateInvalidationCommand({
        DistributionId: this.stackOutputs.CloudFrontDistributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: 1,
            Items: ["/*"],
          },
          CallerReference: Date.now().toString(),
        },
      })
    );

    const invalidationId = invalidation.Invalidation?.Id;
    if (invalidationId) {
      this.logger.info(
        `Waiting for CloudFront invalidation ${invalidationId} to complete (typically 1-5 minutes)...`
      );
      await waitUntilInvalidationCompleted(
        { client: seedCfClient, maxWaitTime: 900 },
        {
          DistributionId: this.stackOutputs.CloudFrontDistributionId,
          Id: invalidationId,
        }
      );
      this.logger.success("CloudFront invalidation completed.");
    }

    this.logger.success(`Frontend deployed to: ${this.frontendUrl}`);
  }
}
