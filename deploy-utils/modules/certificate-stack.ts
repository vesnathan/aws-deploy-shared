/**
 * Certificate Stack Module
 *
 * Deploys ACM certificates to us-east-1 for CloudFront custom domains.
 * Supports automatic DNS validation via Route53.
 */

import * as fs from "fs";
import * as path from "path";
import {
  CloudFormationClient,
  CreateStackCommand,
  UpdateStackCommand,
  DescribeStacksCommand,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
} from "@aws-sdk/client-cloudformation";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Logger } from "../types";

export interface CertificateStackConfig {
  /** Enable certificate stack deployment */
  enabled: boolean;
  /** Include auth subdomain certificate (auth.domain.com) */
  includeAuthCertificate?: boolean;
}

export interface CertificateStackOutputs {
  MainCertificateArn?: string;
  AuthCertificateArn?: string;
}

export interface CertificateStackParams {
  appName: string;
  stage: string;
  mainRegion: string;
  templateBucketName: string;
  cfnRoleArn: string;
  deployDir: string;
  logger: Logger;
}

const CERTIFICATE_REGION = "us-east-1";

/**
 * Deploy certificate stack to us-east-1
 */
export async function deployCertificateStack(
  params: CertificateStackParams,
  config: CertificateStackConfig
): Promise<CertificateStackOutputs> {
  if (!config.enabled) {
    return {};
  }

  const domainName = process.env.DOMAIN_NAME;
  const hostedZoneId = process.env.HOSTED_ZONE_ID;

  if (!domainName || !hostedZoneId) {
    params.logger.info("Skipping certificate stack (DOMAIN_NAME or HOSTED_ZONE_ID not set)");
    return {};
  }

  params.logger.info("\nDeploying certificate stack to us-east-1...");
  params.logger.info(`  Domain: ${domainName}`);

  const cfnClient = new CloudFormationClient({ region: CERTIFICATE_REGION });
  const s3Client = new S3Client({ region: params.mainRegion });
  const stackName = `${params.appName}-certificate-${params.stage}`;

  // Upload certificate template
  const templatePath = path.join(params.deployDir, "resources", "Certificate", "certificate.yaml");
  if (!fs.existsSync(templatePath)) {
    params.logger.warning(`Certificate template not found: ${templatePath}`);
    return {};
  }

  const templateContent = fs.readFileSync(templatePath, "utf-8");
  await s3Client.send(
    new PutObjectCommand({
      Bucket: params.templateBucketName,
      Key: "resources/Certificate/certificate.yaml",
      Body: templateContent,
      ContentType: "application/x-yaml",
    })
  );

  const templateUrl = `https://${params.templateBucketName}.s3.${params.mainRegion}.amazonaws.com/resources/Certificate/certificate.yaml`;

  const parameters = [
    { ParameterKey: "Stage", ParameterValue: params.stage },
    { ParameterKey: "AppName", ParameterValue: params.appName },
    { ParameterKey: "DomainName", ParameterValue: domainName },
    { ParameterKey: "HostedZoneId", ParameterValue: hostedZoneId },
  ];

  // Check if stack exists
  let stackExists = false;
  try {
    await cfnClient.send(new DescribeStacksCommand({ StackName: stackName }));
    stackExists = true;
  } catch {}

  try {
    if (stackExists) {
      params.logger.info(`  Updating certificate stack: ${stackName}`);
      await cfnClient.send(
        new UpdateStackCommand({
          StackName: stackName,
          TemplateURL: templateUrl,
          Parameters: parameters,
          RoleARN: params.cfnRoleArn,
        })
      );
      await waitUntilStackUpdateComplete(
        { client: cfnClient, maxWaitTime: 600 },
        { StackName: stackName }
      );
    } else {
      params.logger.info(`  Creating certificate stack: ${stackName}`);
      params.logger.info("  Note: DNS validation may take a few minutes...");
      await cfnClient.send(
        new CreateStackCommand({
          StackName: stackName,
          TemplateURL: templateUrl,
          Parameters: parameters,
          RoleARN: params.cfnRoleArn,
          DisableRollback: true,
        })
      );
      await waitUntilStackCreateComplete(
        { client: cfnClient, maxWaitTime: 600 },
        { StackName: stackName }
      );
    }
    params.logger.success("  Certificate stack deployed");
  } catch (error: any) {
    if (error.message?.includes("No updates are to be performed")) {
      params.logger.info("  No certificate updates needed");
    } else {
      throw error;
    }
  }

  // Get outputs
  const response = await cfnClient.send(new DescribeStacksCommand({ StackName: stackName }));
  const outputs: CertificateStackOutputs = {};

  for (const output of response.Stacks?.[0]?.Outputs || []) {
    if (output.OutputKey === "MainCertificateArn" || output.OutputKey === "CertificateArn") {
      outputs.MainCertificateArn = output.OutputValue;
    }
    if (output.OutputKey === "AuthCertificateArn") {
      outputs.AuthCertificateArn = output.OutputValue;
    }
  }

  if (outputs.MainCertificateArn) {
    params.logger.info(`  Certificate ARN: ${outputs.MainCertificateArn.substring(0, 60)}...`);
  }

  return outputs;
}
