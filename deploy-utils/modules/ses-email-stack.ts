/**
 * SES Email Stack Module
 *
 * Deploys SES email receiving infrastructure to us-east-1.
 * Handles email forwarding via Lambda.
 */

import * as fs from "fs";
import * as path from "path";
import * as esbuild from "esbuild";
import archiver from "archiver";
import {
  CloudFormationClient,
  CreateStackCommand,
  UpdateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
  waitUntilStackDeleteComplete,
  type Output,
} from "@aws-sdk/client-cloudformation";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  LambdaClient,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
} from "@aws-sdk/client-lambda";
import {
  SESClient,
  SetActiveReceiptRuleSetCommand,
  GetIdentityVerificationAttributesCommand,
} from "@aws-sdk/client-ses";
import {
  IAMClient,
  GetRoleCommand,
  DeleteRoleCommand,
  DetachRolePolicyCommand,
  DeleteRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { Logger } from "../types";

export interface SesEmailStackConfig {
  /** Enable SES email stack deployment */
  enabled: boolean;
  /** Email to forward received emails to (defaults to FORWARD_TO_EMAIL env var) */
  forwardToEmail?: string;
  /** Domain for email receiving (defaults to DOMAIN_NAME env var) */
  domainName?: string;
}

export interface SesEmailStackParams {
  appName: string;
  stage: string;
  mainRegion: string;
  templateBucketName: string;
  cfnRoleArn: string;
  deployDir: string;
  projectRoot: string;
  logger: Logger;
}

const SES_REGION = "us-east-1";

/**
 * Compile Lambda function to zip
 */
async function compileLambda(
  name: string,
  entryPoint: string,
  cacheDir: string
): Promise<Buffer> {
  const outdir = path.join(cacheDir, "lambda", name);
  fs.mkdirSync(outdir, { recursive: true });

  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    target: "node20",
    outfile: path.join(outdir, "index.js"),
    external: ["@aws-sdk/*"],
    minify: true,
  });

  const zipPath = path.join(outdir, `${name}.zip`);
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(path.join(outdir, "index.js"), { name: "index.js" });
    archive.finalize();
  });

  return fs.readFileSync(zipPath);
}

/**
 * Deploy SES email receiving stack to us-east-1
 */
export async function deploySesEmailStack(
  params: SesEmailStackParams,
  config: SesEmailStackConfig
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  const domainName = config.domainName || process.env.DOMAIN_NAME;
  const hostedZoneId = process.env.HOSTED_ZONE_ID;
  const forwardToEmail = config.forwardToEmail || process.env.FORWARD_TO_EMAIL;

  if (!domainName) {
    params.logger.info("Skipping SES stack (DOMAIN_NAME not set)");
    return;
  }

  params.logger.info("\nDeploying SES Email Receiving stack to us-east-1...");

  const cfnClient = new CloudFormationClient({ region: SES_REGION });
  const sesClient = new SESClient({ region: SES_REGION });
  const s3ClientMain = new S3Client({ region: params.mainRegion });
  const s3ClientSes = new S3Client({ region: SES_REGION });
  const lambdaClient = new LambdaClient({ region: SES_REGION });

  const stackName = `${params.appName}-ses-email-receiving-${params.stage}`;

  // Check domain verification
  try {
    const response = await sesClient.send(
      new GetIdentityVerificationAttributesCommand({ Identities: [domainName] })
    );
    const status = response.VerificationAttributes?.[domainName]?.VerificationStatus;
    if (status === "Success") {
      params.logger.info(`  Domain ${domainName} is verified`);
    } else {
      params.logger.warning(`  Domain ${domainName} not verified - email receiving may not work`);
    }
  } catch {}

  // Upload SES template
  const templatePath = path.join(params.deployDir, "resources", "SES", "ses-email-receiving.yaml");
  if (!fs.existsSync(templatePath)) {
    params.logger.warning(`SES template not found: ${templatePath}`);
    return;
  }

  const templateContent = fs.readFileSync(templatePath, "utf-8");
  await s3ClientMain.send(
    new PutObjectCommand({
      Bucket: params.templateBucketName,
      Key: "resources/SES/ses-email-receiving.yaml",
      Body: templateContent,
      ContentType: "application/x-yaml",
    })
  );

  const templateUrl = `https://${params.templateBucketName}.s3.${params.mainRegion}.amazonaws.com/resources/SES/ses-email-receiving.yaml`;

  const parameters = [
    { ParameterKey: "Stage", ParameterValue: params.stage },
    { ParameterKey: "AppName", ParameterValue: params.appName },
    { ParameterKey: "DomainName", ParameterValue: domainName },
    { ParameterKey: "SSMRegion", ParameterValue: params.mainRegion },
    { ParameterKey: "HostedZoneId", ParameterValue: hostedZoneId || "" },
    { ParameterKey: "TemplateBucketName", ParameterValue: params.templateBucketName },
  ];

  if (forwardToEmail) {
    parameters.push({ ParameterKey: "ForwardToEmail", ParameterValue: forwardToEmail });
  }

  // Check stack status
  let stackStatus: { exists: boolean; canUpdate?: boolean } = { exists: false };
  try {
    const response = await cfnClient.send(new DescribeStacksCommand({ StackName: stackName }));
    const status = response.Stacks?.[0]?.StackStatus || "";
    const canUpdate = ["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE"].includes(status);
    stackStatus = { exists: true, canUpdate };

    // Delete failed stack
    if (!canUpdate) {
      params.logger.info(`  Deleting failed SES stack (${status})...`);
      await cfnClient.send(new DeleteStackCommand({ StackName: stackName }));
      await waitUntilStackDeleteComplete({ client: cfnClient, maxWaitTime: 300 }, { StackName: stackName });

      // Cleanup leftover IAM role
      const roleName = `${params.appName}-ses-email-receiver-role-${params.stage}`;
      try {
        const iamClient = new IAMClient({ region: SES_REGION });
        await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
        await iamClient
          .send(
            new DetachRolePolicyCommand({
              RoleName: roleName,
              PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
            })
          )
          .catch(() => {});
        await iamClient.send(new DeleteRolePolicyCommand({ RoleName: roleName, PolicyName: "S3ReadAccess" })).catch(() => {});
        await iamClient.send(new DeleteRolePolicyCommand({ RoleName: roleName, PolicyName: "SSMWriteAccess" })).catch(() => {});
        await iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
      } catch {}

      stackStatus = { exists: false };
    }
  } catch {}

  try {
    if (stackStatus.exists && stackStatus.canUpdate) {
      params.logger.info(`  Updating SES stack: ${stackName}`);
      await cfnClient.send(
        new UpdateStackCommand({
          StackName: stackName,
          TemplateURL: templateUrl,
          Parameters: parameters,
          Capabilities: ["CAPABILITY_NAMED_IAM"],
          RoleARN: params.cfnRoleArn,
        })
      );
      await waitUntilStackUpdateComplete({ client: cfnClient, maxWaitTime: 600 }, { StackName: stackName });
    } else {
      params.logger.info(`  Creating SES stack: ${stackName}`);
      await cfnClient.send(
        new CreateStackCommand({
          StackName: stackName,
          TemplateURL: templateUrl,
          Parameters: parameters,
          Capabilities: ["CAPABILITY_NAMED_IAM"],
          RoleARN: params.cfnRoleArn,
          DisableRollback: true,
        })
      );
      await waitUntilStackCreateComplete({ client: cfnClient, maxWaitTime: 600 }, { StackName: stackName });
    }
    params.logger.success("  SES stack deployed");
  } catch (error: any) {
    if (error.message?.includes("No updates are to be performed")) {
      params.logger.info("  No SES stack updates needed");
    } else {
      throw error;
    }
  }

  // Get Lambda bucket from outputs and update Lambda code
  const response = await cfnClient.send(new DescribeStacksCommand({ StackName: stackName }));
  const lambdaBucket = response.Stacks?.[0]?.Outputs?.find((o: Output) => o.OutputKey === "LambdaCodeBucketName")?.OutputValue;

  if (lambdaBucket) {
    // Check if Lambda source exists
    const lambdaSourcePath = path.join(params.projectRoot, "backend", "lambda", "sesEmailReceiver.ts");
    if (fs.existsSync(lambdaSourcePath)) {
      const cacheDir = path.join(params.deployDir, ".cache");
      const lambdaZip = await compileLambda("sesEmailReceiver", lambdaSourcePath, cacheDir);

      await s3ClientSes.send(
        new PutObjectCommand({
          Bucket: lambdaBucket,
          Key: "sesEmailReceiver.zip",
          Body: lambdaZip,
          ContentType: "application/zip",
        })
      );

      const functionName = `${params.appName}-ses-email-receiver-${params.stage}`;
      try {
        await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
        await lambdaClient.send(
          new UpdateFunctionCodeCommand({
            FunctionName: functionName,
            S3Bucket: lambdaBucket,
            S3Key: "sesEmailReceiver.zip",
          })
        );
        params.logger.info(`  Updated Lambda: ${functionName}`);
      } catch {}
    }
  }

  // Activate rule set
  const ruleSetName = `${params.appName}-e2e-ruleset-${params.stage}`;
  try {
    await sesClient.send(new SetActiveReceiptRuleSetCommand({ RuleSetName: ruleSetName }));
    params.logger.info(`  Activated rule set: ${ruleSetName}`);
  } catch {}

  if (forwardToEmail) {
    params.logger.success(`  Email forwarding: support@${domainName} → ${forwardToEmail}`);
  }
}
