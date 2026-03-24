/**
 * Certificate Stack Module
 *
 * Deploys ACM certificates to us-east-1 for CloudFront custom domains.
 * Supports automatic DNS validation via Route53.
 *
 * SMART BEHAVIOR:
 * - Checks for existing ACM certificates before creating new ones
 * - Reuses existing certificates if they match domain requirements
 * - Only creates CloudFormation stack if certificates don't exist
 * - Saves certificate ARNs to outputs file for reuse
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
import {
  ACMClient,
  ListCertificatesCommand,
  DescribeCertificateCommand,
  CertificateStatus,
} from "@aws-sdk/client-acm";
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

interface ExistingCertificates {
  mainCertArn?: string;
  authCertArn?: string;
}

/**
 * Find existing ACM certificates that match the domain requirements
 */
async function findExistingCertificates(
  domainName: string,
  logger: Logger
): Promise<ExistingCertificates> {
  const acmClient = new ACMClient({ region: CERTIFICATE_REGION });
  const result: ExistingCertificates = {};

  logger.info("  Checking for existing ACM certificates...");

  try {
    // List all certificates in us-east-1
    const listResponse = await acmClient.send(
      new ListCertificatesCommand({
        CertificateStatuses: [CertificateStatus.ISSUED],
      })
    );

    const certificates = listResponse.CertificateSummaryList || [];

    // Look for matching certificates
    for (const cert of certificates) {
      const certDomain = cert.DomainName;
      const certArn = cert.CertificateArn;

      if (!certDomain || !certArn) continue;

      // Check for main certificate (domain.com, *.domain.com, or www.domain.com)
      if (
        certDomain === domainName ||
        certDomain === `*.${domainName}` ||
        certDomain === `www.${domainName}`
      ) {
        // Get certificate details to check SANs
        const describeResponse = await acmClient.send(
          new DescribeCertificateCommand({ CertificateArn: certArn })
        );

        const sans = describeResponse.Certificate?.SubjectAlternativeNames || [];
        const hasWildcard = sans.includes(`*.${domainName}`);
        const hasWww = sans.includes(`www.${domainName}`);
        const hasApex = sans.includes(domainName);

        // Check if cert covers what we need (apex + www, or wildcard)
        if ((hasApex && hasWww) || hasWildcard) {
          result.mainCertArn = certArn;
          logger.info(`    Found main certificate: ${certDomain}`);
          logger.info(`      ARN: ${certArn.substring(0, 60)}...`);
        }
      }

      // Check for auth certificate (auth.domain.com)
      if (certDomain === `auth.${domainName}`) {
        result.authCertArn = certArn;
        logger.info(`    Found auth certificate: ${certDomain}`);
        logger.info(`      ARN: ${certArn.substring(0, 60)}...`);
      }
    }

    if (!result.mainCertArn) {
      logger.info(`    No existing main certificate found for ${domainName}`);
    }
    if (!result.authCertArn) {
      logger.info(`    No existing auth certificate found for auth.${domainName}`);
    }

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warning(`    Error checking existing certificates: ${errorMessage}`);
    return result;
  }
}

/**
 * Deploy certificate stack to us-east-1
 *
 * Smart behavior:
 * 1. Checks for existing ACM certificates first
 * 2. Returns existing certs if found (skips CloudFormation)
 * 3. Creates stack only if certificates don't exist
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

  params.logger.info("\nChecking certificate requirements for us-east-1...");
  params.logger.info(`  Domain: ${domainName}`);

  const needsAuthCert = config.includeAuthCertificate !== false;

  // Step 1: Check for existing certificates
  const existingCerts = await findExistingCertificates(domainName, params.logger);

  const hasMainCert = !!existingCerts.mainCertArn;
  const hasAuthCert = !needsAuthCert || !!existingCerts.authCertArn;

  // If we have all required certificates, return them (skip CloudFormation)
  if (hasMainCert && hasAuthCert) {
    params.logger.success("  Using existing ACM certificates (no CloudFormation needed)");
    return {
      MainCertificateArn: existingCerts.mainCertArn,
      AuthCertificateArn: existingCerts.authCertArn,
    };
  }

  // Step 2: Need to create certificates via CloudFormation
  params.logger.info("\n  Creating certificates via CloudFormation...");

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("No updates are to be performed")) {
      params.logger.info("  No certificate updates needed");
    } else {
      throw error;
    }
  }

  // Get outputs from CloudFormation
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
    params.logger.info(`  Main certificate: ${outputs.MainCertificateArn.substring(0, 60)}...`);
  }
  if (outputs.AuthCertificateArn) {
    params.logger.info(`  Auth certificate: ${outputs.AuthCertificateArn.substring(0, 60)}...`);
  }

  return outputs;
}
