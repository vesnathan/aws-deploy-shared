/**
 * Shared Lambda Compiler
 *
 * Compiles TypeScript Lambda functions to JavaScript:
 * - Discovers Lambda files in backend/lambda
 * - Compiles with esbuild (bundle, minify, tree-shake)
 * - Creates zip archives
 * - Uploads to S3
 * - Directly updates Lambda function code via AWS SDK
 *
 * Used by ALL projects with Lambda functions
 */

import * as path from "path";
import * as fs from "fs";
import * as esbuild from "esbuild";
import archiver from "archiver";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  STSClient,
  AssumeRoleCommand,
} from "@aws-sdk/client-sts";
import {
  LambdaClient,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
} from "@aws-sdk/client-lambda";
import type { Logger } from "./types";

export interface LambdaCompilerConfig {
  logger: Logger;
  projectRoot: string; // Path to project root
  appName: string; // e.g., "helpstay"
  stage: string; // e.g., "dev", "prod"
  region: string; // AWS region
  s3BucketName: string; // Template bucket name
  s3KeyPrefix?: string; // S3 key prefix (default: "functions")
  seedRoleArn?: string; // Optional seed role ARN for updating Lambda code
}

interface LambdaFunction {
  name: string; // camelCase from filename (e.g., "cognitoPreSignUp")
  file: string; // filename (e.g., "cognitoPreSignUp.ts")
  functionName: string; // AWS Lambda function name (e.g., "helpstay-cognito-pre-sign-up-dev")
}

/**
 * Convert camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Lambda Compiler
 *
 * Compiles and uploads Lambda functions
 */
export class LambdaCompiler {
  private logger: Logger;
  private projectRoot: string;
  private appName: string;
  private stage: string;
  private region: string;
  private s3BucketName: string;
  private s3KeyPrefix: string;
  private seedRoleArn: string | null;
  private s3Client: S3Client;
  private stsClient: STSClient;

  constructor(config: LambdaCompilerConfig) {
    this.logger = config.logger;
    this.projectRoot = config.projectRoot;
    this.appName = config.appName;
    this.stage = config.stage;
    this.region = config.region;
    this.s3BucketName = config.s3BucketName;
    this.s3KeyPrefix = config.s3KeyPrefix || "functions";
    this.seedRoleArn = config.seedRoleArn || null;
    this.s3Client = new S3Client({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
  }

  /**
   * Discover Lambda functions in backend/lambda
   */
  public discoverLambdaFunctions(): LambdaFunction[] {
    const lambdaDir = path.join(this.projectRoot, "backend", "lambda");

    if (!fs.existsSync(lambdaDir)) {
      this.logger.warning(`Lambda directory not found: ${lambdaDir}`);
      return [];
    }

    const files = fs.readdirSync(lambdaDir);

    return files
      .filter(
        (f) =>
          f.endsWith(".ts") && !f.includes(".test.") && !f.includes(".d.")
      )
      .map((file) => {
        const name = file.replace(".ts", "");
        const kebabName = toKebabCase(name);
        return {
          name,
          file,
          functionName: `${this.appName}-${kebabName}-${this.stage}`,
        };
      });
  }

  /**
   * Compile a single Lambda function with esbuild
   */
  private async compileLambda(
    name: string,
    entryPoint: string
  ): Promise<Buffer> {
    this.logger.debug(`Compiling Lambda: ${name}`);

    const outdir = path.join(
      this.projectRoot,
      ".cache",
      "deploy",
      "lambda",
      name
    );
    fs.mkdirSync(outdir, { recursive: true });

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: "node",
      target: "node20",
      outfile: path.join(outdir, "index.js"),
      external: ["@aws-sdk/*"],
      minify: true,
      sourcemap: false,
    });

    const zipPath = path.join(outdir, `${name}.zip`);
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", (err: Error) => reject(err));

      archive.pipe(output);
      archive.file(path.join(outdir, "index.js"), { name: "index.js" });
      archive.finalize();
    });

    return fs.readFileSync(zipPath);
  }

  /**
   * Upload Lambda zip to S3
   */
  private async uploadLambdaToS3(
    lambdaName: string,
    zipBuffer: Buffer
  ): Promise<string> {
    // s3KeyPrefix already contains the stage (e.g., "functions/prod")
    // Don't add stage again!
    const s3Key = path.posix.join(
      this.s3KeyPrefix,
      `${lambdaName}.zip`
    );

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: s3Key,
        Body: zipBuffer,
        ContentType: "application/zip",
      })
    );

    return s3Key;
  }

  /**
   * Compile and upload all Lambda functions
   */
  public async compileAndUploadLambdas(): Promise<LambdaFunction[]> {
    this.logger.info("Compiling and uploading Lambda functions...");

    const lambdaFunctions = this.discoverLambdaFunctions();

    if (lambdaFunctions.length === 0) {
      this.logger.info("No Lambda functions found");
      return [];
    }

    this.logger.info(`Discovered ${lambdaFunctions.length} Lambda functions:`);
    for (const fn of lambdaFunctions) {
      this.logger.debug(`  - ${fn.file}`);
    }

    const lambdaDir = path.join(this.projectRoot, "backend", "lambda");

    for (const lambda of lambdaFunctions) {
      try {
        const entryPoint = path.join(lambdaDir, lambda.file);
        if (!fs.existsSync(entryPoint)) {
          this.logger.warning(`Skipping ${lambda.name} (file not found)`);
          continue;
        }

        const zip = await this.compileLambda(lambda.name, entryPoint);
        const s3Key = await this.uploadLambdaToS3(lambda.name, zip);
        this.logger.success(`Uploaded: ${s3Key}`);
      } catch (error) {
        this.logger.error(`Error compiling ${lambda.name}: ${String(error)}`);
        throw error;
      }
    }

    return lambdaFunctions;
  }

  /**
   * Update Lambda function code directly via AWS SDK
   *
   * This is necessary because CloudFormation doesn't detect S3 content changes
   * when the S3 key stays the same.
   */
  public async updateLambdaCode(lambdaFunctions: LambdaFunction[]): Promise<void> {
    if (!this.seedRoleArn) {
      this.logger.info("Skipping Lambda code updates (no SeedRoleArn)");
      return;
    }

    this.logger.info("Updating Lambda function code...");
    this.logger.debug("Assuming seed role for Lambda access...");

    const assumeRoleResponse = await this.stsClient.send(
      new AssumeRoleCommand({
        RoleArn: this.seedRoleArn,
        RoleSessionName: "lambda-update-session",
        ExternalId: `${this.appName}-seed-${this.stage}`,
        DurationSeconds: 900,
      })
    );

    const credentials = assumeRoleResponse.Credentials!;
    const lambdaClientWithRole = new LambdaClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.AccessKeyId!,
        secretAccessKey: credentials.SecretAccessKey!,
        sessionToken: credentials.SessionToken!,
      },
    });

    for (const lambda of lambdaFunctions) {
      // s3KeyPrefix already contains the stage (e.g., "functions/prod")
      const s3Key = path.posix.join(
        this.s3KeyPrefix,
        `${lambda.name}.zip`
      );

      try {
        // Check if function exists
        await lambdaClientWithRole.send(
          new GetFunctionCommand({ FunctionName: lambda.functionName })
        );

        // Update function code
        await lambdaClientWithRole.send(
          new UpdateFunctionCodeCommand({
            FunctionName: lambda.functionName,
            S3Bucket: this.s3BucketName,
            S3Key: s3Key,
          })
        );

        this.logger.success(`Updated: ${lambda.functionName}`);
      } catch (lambdaError: unknown) {
        const errorMessage =
          lambdaError instanceof Error
            ? lambdaError.message
            : String(lambdaError);
        if (
          errorMessage.includes("ResourceNotFoundException") ||
          errorMessage.includes("Function not found")
        ) {
          // Function doesn't exist yet - skip
          this.logger.debug(`Function ${lambda.functionName} not found (will be created by CloudFormation)`);
          continue;
        }
        this.logger.warning(
          `Could not update ${lambda.functionName}: ${errorMessage}`
        );
      }
    }
  }
}
