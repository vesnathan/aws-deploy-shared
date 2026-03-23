/**
 * AWS Credentials Management
 *
 * Handles AWS credential configuration and validation for deployment scripts.
 */

import inquirer from "inquirer";
import { logger } from "./logger";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import { AwsCredentialIdentity } from "@aws-sdk/types";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export interface AwsCredentialsConfig {
  /** Path to save credentials (defaults to project root .env) */
  envFilePath?: string;
  /** Region for STS validation (defaults to us-east-1) */
  validationRegion?: string;
  /** Skip interactive prompts if credentials are missing */
  nonInteractive?: boolean;
}

/**
 * Get AWS credentials from environment variables
 */
export async function getAwsCredentials(
  config?: AwsCredentialsConfig
): Promise<AwsCredentialIdentity | undefined> {
  const nonInteractive = config?.nonInteractive ?? false;

  if (!nonInteractive) {
    await configureAwsCredentials(config);
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  return undefined;
}

/**
 * Validate existing AWS credentials
 */
export async function validateAwsCredentials(
  region: string = "us-east-1"
): Promise<boolean> {
  if (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY
  ) {
    return false;
  }

  try {
    const stsClient = new STSClient({ region });
    await stsClient.send(new GetCallerIdentityCommand({}));
    return true;
  } catch {
    return false;
  }
}

/**
 * Configure AWS credentials interactively if needed
 */
export async function configureAwsCredentials(
  config?: AwsCredentialsConfig
): Promise<void> {
  const validationRegion = config?.validationRegion ?? "us-east-1";

  // Only ask for credentials if they're not already set or fail validation
  const validateExistingCredentials = async (): Promise<boolean> => {
    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY ||
      !process.env.AWS_ACCOUNT_ID
    ) {
      return false;
    }

    try {
      const stsClient = new STSClient({ region: validationRegion });
      await stsClient.send(new GetCallerIdentityCommand({}));
      logger.success("Existing AWS credentials validated successfully");
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warning(`Existing credentials failed validation: ${message}`);
      return false;
    }
  };

  const isValid = await validateExistingCredentials();
  if (!isValid) {
    logger.info("Please enter your AWS credentials:");

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "accessKeyId",
        message: "AWS Access Key ID:",
        validate: (input: string) => {
          return input.length > 0 ? true : "Access Key ID cannot be empty";
        },
      },
      {
        type: "password",
        name: "secretAccessKey",
        message: "AWS Secret Access Key:",
        mask: "*",
        validate: (input: string) => {
          return input.length > 0 ? true : "Secret Access Key cannot be empty";
        },
      },
      {
        type: "input",
        name: "accountId",
        message: "AWS Account ID:",
        validate: (input: string) => {
          return /^\d{12}$/.test(input) ? true : "Account ID must be 12 digits";
        },
      },
    ]);

    // Set the credentials in environment variables
    process.env.AWS_ACCESS_KEY_ID = answers.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = answers.secretAccessKey;
    process.env.AWS_ACCOUNT_ID = answers.accountId;

    // Save credentials to .env file if path provided
    if (config?.envFilePath) {
      try {
        const envContent = `AWS_ACCESS_KEY_ID=${answers.accessKeyId}
AWS_SECRET_ACCESS_KEY=${answers.secretAccessKey}
AWS_ACCOUNT_ID=${answers.accountId}`;
        writeFileSync(config.envFilePath, envContent);
        logger.success(`AWS credentials saved to ${config.envFilePath}`);
      } catch {
        logger.warning(
          "Could not save credentials to .env file. They will only persist for this session."
        );
      }
    }

    // Validate the new credentials
    try {
      const stsClient = new STSClient({ region: validationRegion });
      await stsClient.send(new GetCallerIdentityCommand({}));
      logger.success("AWS credentials configured and validated successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to validate AWS credentials: ${message}`);
      throw error;
    }
  }
}

/**
 * Get AWS Account ID from environment or STS
 */
export async function getAwsAccountId(
  region: string = "us-east-1"
): Promise<string | undefined> {
  if (process.env.AWS_ACCOUNT_ID) {
    return process.env.AWS_ACCOUNT_ID;
  }

  try {
    const stsClient = new STSClient({ region });
    const response = await stsClient.send(new GetCallerIdentityCommand({}));
    return response.Account;
  } catch {
    return undefined;
  }
}
