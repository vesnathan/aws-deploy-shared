/**
 * Shared Bootstrap Checker
 *
 * Checks that required bootstrap resources exist before deployment:
 * - S3 template bucket
 * - CloudFormation service role
 * - Deploy IAM user with proper permissions
 * - AWS credentials validity
 *
 * Provides step-by-step instructions for creating missing resources
 *
 * Used by ALL projects before CloudFormation deployment
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import {
  S3Client,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import {
  IAMClient,
  GetRoleCommand,
  GetUserCommand,
} from "@aws-sdk/client-iam";
import {
  STSClient,
  GetCallerIdentityCommand,
} from "@aws-sdk/client-sts";

const MAIN_REGION = "ap-southeast-2";

/**
 * Prompt user for input
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Update .env file with AWS credentials
 */
function updateEnvFile(
  projectRoot: string,
  accessKeyId: string,
  secretAccessKey: string
): void {
  const envPath = path.join(projectRoot, ".env");
  let content = "";
  try {
    content = fs.readFileSync(envPath, "utf-8");
  } catch {
    // .env doesn't exist yet
  }

  if (content.includes("AWS_ACCESS_KEY_ID=")) {
    content = content.replace(
      /AWS_ACCESS_KEY_ID=.*/g,
      `AWS_ACCESS_KEY_ID=${accessKeyId}`
    );
  } else {
    content = `AWS_ACCESS_KEY_ID=${accessKeyId}\n${content}`;
  }

  if (content.includes("AWS_SECRET_ACCESS_KEY=")) {
    content = content.replace(
      /AWS_SECRET_ACCESS_KEY=.*/g,
      `AWS_SECRET_ACCESS_KEY=${secretAccessKey}`
    );
  } else {
    content = `AWS_SECRET_ACCESS_KEY=${secretAccessKey}\n${content}`;
  }

  fs.writeFileSync(envPath, content);
}

export interface BootstrapConfig {
  templateBucketName: string;
  cfnRoleName: string;
  cfnRoleArn: string;
  deployUserName: string;
  region: string;
}

export interface BootstrapCheckResult {
  ready: boolean;
  missingBucket: boolean;
  missingRole: boolean;
  missingUser: boolean;
  config: BootstrapConfig;
}

export interface BootstrapCheckerConfig {
  appName: string; // e.g., "helpstay", "quiz-night-live"
  projectRoot: string; // Path to project root (for .env file)
  templateBucketName?: string; // Default: `${appName}-deploy-templates`
  cfnRoleName?: string; // Default: `${appName}-cfn-role`
  deployUserName?: string; // Default: `${appName}-deploy`
  region?: string; // Default: ap-southeast-2
}

/**
 * Bootstrap Checker
 *
 * Checks and manages bootstrap resources
 */
export class BootstrapChecker {
  private appName: string;
  private projectRoot: string;
  private templateBucketName: string;
  private cfnRoleName: string;
  private deployUserName: string;
  private region: string;

  constructor(config: BootstrapCheckerConfig) {
    this.appName = config.appName;
    this.projectRoot = config.projectRoot;
    this.templateBucketName =
      config.templateBucketName || `${config.appName}-deploy-templates`;
    this.cfnRoleName = config.cfnRoleName || `${config.appName}-cfn-role`;
    this.deployUserName =
      config.deployUserName || `${config.appName}-deploy`;
    this.region = config.region || MAIN_REGION;
  }

  /**
   * Check if AWS credentials are valid
   */
  public async checkCredentials(): Promise<{ valid: boolean; identity?: string }> {
    const sts = new STSClient({ region: this.region });
    try {
      const response = await sts.send(new GetCallerIdentityCommand({}));
      return { valid: true, identity: response.Arn };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Prompt user for AWS credentials
   */
  public async promptForCredentials(): Promise<boolean> {
    console.log(`
${"=".repeat(60)}
  AWS CREDENTIALS INVALID OR MISSING
${"=".repeat(60)}

The AWS credentials in .env are invalid or expired.

You need access keys for the ${this.deployUserName} IAM user.
If you haven't created this user yet, do that first:

  1. Go to IAM > Users > Create user
  2. User name: ${this.deployUserName}
  3. Create user (no console access needed)
  4. Add inline policy from: deploy/iam-policies/${this.deployUserName}-policy.json
  5. Create access key (CLI use case)

`);

    const accessKeyId = await prompt("Enter AWS_ACCESS_KEY_ID: ");
    if (!accessKeyId) {
      console.log("\nNo access key provided. Exiting.");
      return false;
    }

    const secretAccessKey = await prompt("Enter AWS_SECRET_ACCESS_KEY: ");
    if (!secretAccessKey) {
      console.log("\nNo secret key provided. Exiting.");
      return false;
    }

    console.log("\nValidating credentials...");
    process.env.AWS_ACCESS_KEY_ID = accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;

    const { valid, identity } = await this.checkCredentials();
    if (!valid) {
      console.log("Invalid credentials. Please check and try again.");
      return false;
    }

    console.log(`Credentials valid! Identity: ${identity}`);
    updateEnvFile(this.projectRoot, accessKeyId, secretAccessKey);
    console.log("Credentials saved to .env\n");

    return true;
  }

  /**
   * Get bootstrap configuration
   */
  public getBootstrapConfig(): BootstrapConfig {
    const accountId = process.env.AWS_ACCOUNT_ID || "430118819356";
    const cfnRoleArn =
      process.env.CFN_ROLE_ARN ||
      `arn:aws:iam::${accountId}:role/${this.cfnRoleName}`;
    const cfnRoleName = cfnRoleArn.split("/").pop() || this.cfnRoleName;

    return {
      templateBucketName: this.templateBucketName,
      cfnRoleName,
      cfnRoleArn,
      deployUserName: this.deployUserName,
      region: this.region,
    };
  }

  /**
   * Check bootstrap resources (bucket, role, user)
   */
  public async checkBootstrapResources(): Promise<BootstrapCheckResult> {
    const config = this.getBootstrapConfig();

    const s3 = new S3Client({ region: this.region });
    const iam = new IAMClient({ region: this.region });

    let missingBucket = false;
    let missingRole = false;
    let missingUser = false;

    // Check template bucket
    try {
      await s3.send(
        new GetBucketLocationCommand({ Bucket: config.templateBucketName })
      );
    } catch {
      missingBucket = true;
    }

    // Check CloudFormation role
    try {
      await iam.send(new GetRoleCommand({ RoleName: config.cfnRoleName }));
    } catch {
      missingRole = true;
    }

    // Check deploy user
    try {
      await iam.send(new GetUserCommand({ UserName: config.deployUserName }));
    } catch {
      missingUser = true;
    }

    const ready = !missingBucket && !missingRole && !missingUser;

    return {
      ready,
      missingBucket,
      missingRole,
      missingUser,
      config,
    };
  }

  /**
   * Print bootstrap instructions for missing resources
   */
  public printBootstrapInstructions(result: BootstrapCheckResult): void {
    const { missingBucket, missingRole, missingUser, config } = result;

    // Print only the FIRST missing resource
    if (missingBucket) {
      console.log(`
${"=".repeat(70)}
  BOOTSTRAP STEP 1/3: S3 Template Bucket
${"=".repeat(70)}

Create an S3 bucket named: ${config.templateBucketName}

${"─".repeat(70)}
CloudShell Command (copy & paste):
${"─".repeat(70)}

aws s3 mb s3://${config.templateBucketName} --region ${this.region}

${"=".repeat(70)}
  After creating the bucket, run the deploy again.
${"=".repeat(70)}
`);
      return;
    }

    if (missingRole) {
      console.log(`
${"=".repeat(70)}
  BOOTSTRAP STEP 2/3: CloudFormation Service Role
${"=".repeat(70)}

Create an IAM role named: ${config.cfnRoleName}

${"─".repeat(70)}
CloudShell Commands (copy & paste each line):
${"─".repeat(70)}

aws iam create-role --role-name ${config.cfnRoleName} --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"cloudformation.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam attach-role-policy --role-name ${config.cfnRoleName} --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

${"=".repeat(70)}
  After creating the role, run the deploy again.
${"=".repeat(70)}
`);
      return;
    }

    if (missingUser) {
      // Read the policy from the JSON file
      let policyJson: string;
      try {
        const policyPath = path.join(
          this.projectRoot,
          "deploy",
          "iam-policies",
          `${this.deployUserName}-policy.json`
        );
        const rawPolicy = fs.readFileSync(policyPath, "utf-8");
        policyJson = rawPolicy;
      } catch {
        policyJson = `{"error": "Could not read deploy/iam-policies/${this.deployUserName}-policy.json"}`;
      }

      // Compact JSON for CLI command
      const compactPolicy = JSON.stringify(JSON.parse(policyJson));

      console.log(`
${"=".repeat(70)}
  BOOTSTRAP STEP 3/3: Deploy IAM User
${"=".repeat(70)}

Create an IAM user named: ${config.deployUserName}

Policy file: deploy/iam-policies/${this.deployUserName}-policy.json

${"─".repeat(70)}
CloudShell Commands (copy & paste each line):
${"─".repeat(70)}

aws iam create-user --user-name ${config.deployUserName}

aws iam put-user-policy --user-name ${config.deployUserName} --policy-name ${config.deployUserName}-policy --policy-document '${compactPolicy}'

aws iam create-access-key --user-name ${config.deployUserName}

${"─".repeat(70)}
IMPORTANT: Save the AccessKeyId and SecretAccessKey from the output above!
Add them to your .env file:

  AWS_ACCESS_KEY_ID=<AccessKeyId>
  AWS_SECRET_ACCESS_KEY=<SecretAccessKey>
  DEPLOY_USER_ARN=arn:aws:iam::<account-id>:user/${config.deployUserName}
${"─".repeat(70)}

${"=".repeat(70)}
  After creating the user and saving credentials, run the deploy again.
${"=".repeat(70)}
`);
      return;
    }
  }
}
