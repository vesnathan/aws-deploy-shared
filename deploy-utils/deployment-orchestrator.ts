/**
 * Shared Deployment Orchestrator
 *
 * ⚠️ CRITICAL: This file is used by MULTIPLE projects!
 *
 * Changes to this file affect ALL projects using shared deployment utilities.
 * Before modifying, test against all integrated projects (see README.md).
 *
 * Main entry point for ALL deployment scripts
 * Handles the entire deployment flow with callbacks for project-specific logic
 *
 * @see /home/liqk1ugzoezh5okwywlr_/dev/shared/deploy-utils/README.md
 */

import * as path from "path";
import * as fs from "fs";
import { logger, setLogFile, closeLogFile } from "./logger";
import { BootstrapChecker } from "./bootstrap-checker";
import { ResolverCompiler } from "./resolver-compiler";
import { LambdaCompiler } from "./lambda-compiler";
import { SchemaManager } from "./schema-manager";
import { FrontendDeployment } from "./frontend-deployment";
import { StackManager } from "./stack-manager";
import { TemplateUploader } from "./template-uploader";
import { MenuSystem, type DeployOption, type StageOption } from "./menu-system";
import { removeStack } from "./removal-orchestrator";
import { OrphanChecker } from "./orphan-checker";
import { OutputsManager, type StackOutput } from "./outputs-manager";
import {
  deployCertificateStack,
  type CertificateStackConfig,
  type CertificateStackOutputs,
} from "./modules/certificate-stack";
import {
  deploySesEmailStack,
  type SesEmailStackConfig,
} from "./modules/ses-email-stack";
import {
  createCognitoAdminUser,
  type CognitoAdminUserConfig,
} from "./modules/cognito-admin-user";
import {
  seedDatabase as seedDatabaseModule,
  type SeedDatabaseConfig,
} from "./modules/seed-database";

export interface StackOutputs {
  CloudFrontDistributionId?: string;
  CloudFrontDomainName?: string;
  WebsiteBucket?: string;
  UserPoolId?: string;
  UserPoolClientId?: string;
  IdentityPoolId?: string;
  ApiUrl?: string;
  DataTableName?: string;
  SeedRoleArn?: string;
  CognitoDomain?: string;
  GoogleOAuthEnabled?: string;
  [key: string]: string | undefined;
}

export interface DeploymentOrchestratorConfig<TStage extends string = string> {
  appName: string; // e.g., "helpstay"
  projectRoot: string; // Path to project root
  region?: string; // Default: ap-southeast-2
  deployUserName?: string; // Default: `${appName}-deploy`, use "deploy" for shared user

  // Stage options (e.g., [{stage: "dev", ...}, {stage: "prod", ...}])
  stages: StageOption<TStage>[];

  // Project-specific stack parameters
  getStackParameters: (
    stage: TStage,
    buildHashes: {
      resolvers: string;
      schema: string;
      templates: string;
    }
  ) => Array<{ ParameterKey: string; ParameterValue: string }>;

  // Project-specific frontend env vars
  getFrontendEnvVars?: (
    stage: TStage,
    outputs: StackOutputs
  ) => Record<string, string>;

  // Project-specific Cognito domain override (for prod custom domains)
  getCognitoDomain?: (stage: TStage, outputs: StackOutputs) => string;

  // Project-specific frontend URL override (for prod custom domains)
  getFrontendUrl?: (stage: TStage, outputs: StackOutputs) => string;

  /**
   * Project-specific seed function (optional)
   * WARNING: Only runs on dev by default. Set seedDevOnly: false to allow prod.
   */
  seedDatabase?: (outputs: StackOutputs, stage: TStage) => Promise<void>;

  /** Block seeding on prod (default: true). Set to false to allow prod seeding. */
  seedDevOnly?: boolean;

  // Pre-deployment hook (e.g., for certificate stacks)
  preDeploy?: (stage: TStage) => Promise<void>;

  // Post-deployment hook (e.g., for logging, cleanup)
  postDeploy?: (stage: TStage, outputs: StackOutputs) => Promise<void>;

  // ============================================
  // OPTIONAL MODULES (auto-called when enabled)
  // ============================================

  /**
   * Certificate stack deployment (us-east-1 for CloudFront)
   * Automatically deployed before main stack when enabled
   */
  certificateStack?: CertificateStackConfig & {
    /** Use main certificate ARN in stack parameters (parameter name) */
    parameterName?: string;
    /** Use auth certificate ARN in stack parameters (parameter name) */
    authParameterName?: string;
  };

  /**
   * SES email receiving stack (us-east-1)
   * Automatically deployed before main stack when enabled
   */
  sesEmailStack?: SesEmailStackConfig;

  /**
   * Cognito admin user creation
   * Automatically created after main stack when enabled
   */
  cognitoAdminUser?: CognitoAdminUserConfig;

  /**
   * Database seeding from file or function
   * Alternative to providing a custom seedDatabase callback
   */
  seedDatabaseConfig?: SeedDatabaseConfig;

  /**
   * Regex pattern to identify test users during removal
   * Users matching this pattern won't block stack deletion
   * e.g., "^vesnathan" matches emails starting with "vesnathan"
   */
  testUserPattern?: string;
}

/**
 * CLI arguments for non-interactive deployment
 */
export interface CLIArgs {
  stage?: string; // --stage dev|prod
  action?: DeployOption; // --action full|frontend|stack|...
  yes?: boolean; // -y, --yes - skip confirmations
  help?: boolean; // --help
}

/**
 * Parse CLI arguments
 */
function parseCliArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--stage" && args[i + 1]) {
      result.stage = args[i + 1];
      i++;
    } else if (arg.startsWith("--stage=")) {
      result.stage = arg.split("=")[1];
    } else if (arg === "--action" && args[i + 1]) {
      result.action = args[i + 1] as DeployOption;
      i++;
    } else if (arg.startsWith("--action=")) {
      result.action = arg.split("=")[1] as DeployOption;
    } else if (arg === "-y" || arg === "--yes") {
      result.yes = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

/**
 * Deployment Orchestrator
 *
 * Main deployment orchestration class
 */
export class DeploymentOrchestrator<TStage extends string = string> {
  private config: DeploymentOrchestratorConfig<TStage>;
  private appName: string;
  private projectRoot: string;
  private region: string;
  private bootstrapChecker: BootstrapChecker;
  private certificateOutputs: CertificateStackOutputs = {};

  constructor(config: DeploymentOrchestratorConfig<TStage>) {
    this.config = config;
    this.appName = config.appName;
    this.projectRoot = config.projectRoot;
    this.region = config.region || "ap-southeast-2";

    // Initialize bootstrap checker
    this.bootstrapChecker = new BootstrapChecker({
      appName: this.appName,
      projectRoot: this.projectRoot,
      region: this.region,
      deployUserName: config.deployUserName,
    });
  }

  /**
   * Run pre-deploy modules (certificate stack, SES stack)
   */
  private async runPreDeployModules(stage: TStage): Promise<void> {
    const bootstrapConfig = this.bootstrapChecker.getBootstrapConfig();
    const deployDir = path.join(this.projectRoot, "deploy");

    // Deploy certificate stack if enabled
    if (this.config.certificateStack?.enabled) {
      this.certificateOutputs = await deployCertificateStack(
        {
          appName: this.appName,
          stage,
          mainRegion: this.region,
          templateBucketName: bootstrapConfig.templateBucketName,
          cfnRoleArn: bootstrapConfig.cfnRoleArn,
          deployDir,
          logger,
        },
        this.config.certificateStack
      );
    }

    // Deploy SES email stack if enabled
    if (this.config.sesEmailStack?.enabled) {
      await deploySesEmailStack(
        {
          appName: this.appName,
          stage,
          mainRegion: this.region,
          templateBucketName: bootstrapConfig.templateBucketName,
          cfnRoleArn: bootstrapConfig.cfnRoleArn,
          deployDir,
          projectRoot: this.projectRoot,
          logger,
        },
        this.config.sesEmailStack
      );
    }

    // Run custom preDeploy hook if provided
    if (this.config.preDeploy) {
      logger.info("Running custom pre-deploy hook...");
      await this.config.preDeploy(stage);
    }
  }

  /**
   * Run post-deploy modules (admin user creation, database seeding)
   */
  private async runPostDeployModules(
    stage: TStage,
    outputs: StackOutputs
  ): Promise<void> {
    // Create admin user if enabled
    if (this.config.cognitoAdminUser?.enabled && outputs.UserPoolId) {
      await createCognitoAdminUser(
        {
          userPoolId: outputs.UserPoolId,
          region: this.region,
          logger,
        },
        this.config.cognitoAdminUser
      );
    }

    // Seed database if module config provided (alternative to callback)
    if (this.config.seedDatabaseConfig?.enabled && outputs.DataTableName) {
      await seedDatabaseModule(
        {
          appName: this.appName,
          stage,
          region: this.region,
          tableName: outputs.DataTableName,
          seedRoleArn: outputs.SeedRoleArn,
          projectRoot: this.projectRoot,
          logger,
        },
        this.config.seedDatabaseConfig
      );
    }

    // Run custom postDeploy hook if provided
    if (this.config.postDeploy) {
      logger.info("Running custom post-deploy hook...");
      await this.config.postDeploy(stage, outputs);
    }
  }

  /**
   * Inject certificate ARNs into stack parameters if configured
   */
  private injectCertificateParam(
    parameters: Array<{ ParameterKey: string; ParameterValue: string }>
  ): Array<{ ParameterKey: string; ParameterValue: string }> {
    // Inject main certificate ARN
    const mainParamName = this.config.certificateStack?.parameterName;
    const mainCertArn = this.certificateOutputs.MainCertificateArn;

    if (mainParamName && mainCertArn) {
      const existing = parameters.find((p) => p.ParameterKey === mainParamName);
      if (existing) {
        existing.ParameterValue = mainCertArn;
      } else {
        parameters.push({ ParameterKey: mainParamName, ParameterValue: mainCertArn });
      }
      logger.info(`  Injected ${mainParamName}: ${mainCertArn.substring(0, 50)}...`);
    }

    // Inject auth certificate ARN
    const authParamName = this.config.certificateStack?.authParameterName;
    const authCertArn = this.certificateOutputs.AuthCertificateArn;

    if (authParamName && authCertArn) {
      const existing = parameters.find((p) => p.ParameterKey === authParamName);
      if (existing) {
        existing.ParameterValue = authCertArn;
      } else {
        parameters.push({ ParameterKey: authParamName, ParameterValue: authCertArn });
      }
      logger.info(`  Injected ${authParamName}: ${authCertArn.substring(0, 50)}...`);
    }

    return parameters;
  }

  /**
   * Cleanup old log files
   */
  private cleanupOldFiles(
    dir: string,
    pattern: RegExp,
    keepLatest: number = 0
  ): void {
    if (!fs.existsSync(dir)) return;

    const files = fs
      .readdirSync(dir)
      .filter((f) => pattern.test(f))
      .map((f) => ({
        name: f,
        path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const toDelete = files.slice(keepLatest);
    for (const file of toDelete) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Execute deployment based on selected option
   */
  private async executeDeployment(
    option: DeployOption,
    stage: TStage
  ): Promise<void> {
    const bootstrapConfig = this.bootstrapChecker.getBootstrapConfig();
    const templateBucket = bootstrapConfig.templateBucketName;
    const stackName = `${this.appName}-${stage}`;
    const cfnRoleArn = bootstrapConfig.cfnRoleArn;
    const deployDir = path.join(this.projectRoot, "deploy");
    const backendDir = path.join(this.projectRoot, "backend");

    // Initialize shared managers
    const schemaManager = new SchemaManager({
      logger,
      projectRoot: this.projectRoot,
      s3BucketName: templateBucket,
      s3KeyPrefix: `schema/${stage}`,
      region: this.region,
    });

    const resolverCompiler = new ResolverCompiler({
      logger,
      projectRoot: this.projectRoot,
      appName: this.appName,
      stage: stage,
      s3BucketName: templateBucket,
      region: this.region,
      s3KeyPrefix: "resolvers",
    });

    const lambdaCompiler = new LambdaCompiler({
      logger,
      projectRoot: this.projectRoot,
      appName: this.appName,
      stage: stage,
      s3BucketName: templateBucket,
      region: this.region,
      s3KeyPrefix: `functions/${stage}`,
    });

    const templateUploader = new TemplateUploader({
      logger,
      deployDir,
      s3BucketName: templateBucket,
      region: this.region,
    });

    // Build hashes
    let resolversBuildHash = "initial";
    let schemaBuildHash = "initial";
    let templateBuildHash = "initial";

    switch (option) {
      case "orphans": {
        const orphanChecker = new OrphanChecker({
          appName: this.appName,
          stage: stage,
          region: this.region,
          logger,
        });

        const orphans = await orphanChecker.checkAll();
        await orphanChecker.interactiveCleanup(orphans);
        break;
      }

      case "frontend": {
        // Try to load outputs from local file first (faster, no AWS call needed)
        const outputsManagerFe = new OutputsManager(this.projectRoot, this.appName);
        let outputs = await outputsManagerFe.getOutputs(stage);

        if (!outputs) {
          logger.info("No local outputs file found, fetching from AWS...");
          const stackManager = new StackManager({
            logger,
            stackName,
            region: this.region,
            templateUrl: `https://${templateBucket}.s3.${this.region}.amazonaws.com/cfn-template.yaml`,
            parameters: [],
            cfnRoleArn,
          });
          outputs = await stackManager.getStackOutputs();

          // Save for next time
          await outputsManagerFe.saveOutputs(stage, stackName, this.region, outputs);
          logger.success(`Outputs saved to: ${outputsManagerFe.getFilePath()}`);
        } else {
          logger.success(`Using cached outputs from: ${outputsManagerFe.getFilePath()}`);
        }

        // Apply project-specific overrides if provided
        const cognitoDomain = this.config.getCognitoDomain
          ? this.config.getCognitoDomain(stage, outputs)
          : outputs.CognitoDomain || "";

        const frontendUrl = this.config.getFrontendUrl
          ? this.config.getFrontendUrl(stage, outputs)
          : `https://${outputs.CloudFrontDomainName || ""}`;

        const frontendDeployment = new FrontendDeployment({
          logger,
          projectRoot: this.projectRoot,
          appName: this.appName,
          stage: stage,
          region: this.region,
          stackOutputs: { ...outputs, CognitoDomain: cognitoDomain },
          frontendUrl,
          envVars: this.config.getFrontendEnvVars
            ? this.config.getFrontendEnvVars(stage, outputs)
            : {},
        });

        await frontendDeployment.buildFrontend();
        await frontendDeployment.deployFrontend();
        break;
      }

      case "lambdas": {
        const lambdaFunctions = await lambdaCompiler.compileAndUploadLambdas();

        // Try to load outputs from local file first
        const outputsManagerLambda = new OutputsManager(this.projectRoot, this.appName);
        let outputs = await outputsManagerLambda.getOutputs(stage);

        if (!outputs) {
          logger.info("No local outputs file found, fetching from AWS...");
          const stackManager = new StackManager({
            logger,
            stackName,
            region: this.region,
            templateUrl: `https://${templateBucket}.s3.${this.region}.amazonaws.com/cfn-template.yaml`,
            parameters: [],
            cfnRoleArn,
          });
          outputs = await stackManager.getStackOutputs();
          await outputsManagerLambda.saveOutputs(stage, stackName, this.region, outputs);
        }

        // Create new compiler with seedRoleArn for updates
        const lambdaUpdater = new LambdaCompiler({
          logger,
          projectRoot: this.projectRoot,
          appName: this.appName,
          stage: stage,
          s3BucketName: templateBucket,
          region: this.region,
          s3KeyPrefix: `functions/${stage}`,
          seedRoleArn: outputs.SeedRoleArn,
        });
        await lambdaUpdater.updateLambdaCode(lambdaFunctions);
        break;
      }

      case "schema":
        schemaBuildHash = await schemaManager.mergeAndUploadSchema();
        logger.info(
          "\nNote: Run 'CloudFormation Stack' deploy to apply schema changes"
        );
        break;

      case "resolvers":
        resolversBuildHash = await resolverCompiler.compileAndUploadResolvers();
        logger.info(
          "\nNote: Run 'CloudFormation Stack' deploy to apply resolver changes"
        );
        break;

      case "stack": {
        // Run pre-deploy modules (certificate, SES, custom hook)
        await this.runPreDeployModules(stage);

        schemaBuildHash = await schemaManager.mergeAndUploadSchema();
        templateBuildHash = await templateUploader.uploadTemplates();
        resolversBuildHash = await resolverCompiler.compileAndUploadResolvers();
        const lambdaFunctions = await lambdaCompiler.compileAndUploadLambdas();

        let stackParameters = this.config.getStackParameters(stage, {
          resolvers: resolversBuildHash,
          schema: schemaBuildHash,
          templates: templateBuildHash,
        });

        // Inject certificate ARN if configured
        stackParameters = this.injectCertificateParam(stackParameters);

        const stackManager = new StackManager({
          logger,
          stackName,
          region: this.region,
          templateUrl: `https://${templateBucket}.s3.${this.region}.amazonaws.com/cfn-template.yaml`,
          parameters: stackParameters,
          cfnRoleArn,
        });

        await stackManager.deployStack();
        const outputs = await stackManager.getStackOutputs();
        logger.info("Stack Outputs:\n" + JSON.stringify(outputs, null, 2));

        // Save outputs to local file for easy access
        const outputsManager = new OutputsManager(this.projectRoot, this.appName);
        await outputsManager.saveOutputs(stage, stackName, this.region, outputs);
        logger.success(`Outputs saved to: ${outputsManager.getFilePath()}`);

        // Create new compiler with seedRoleArn for Lambda updates
        const lambdaUpdater = new LambdaCompiler({
          logger,
          projectRoot: this.projectRoot,
          appName: this.appName,
          stage: stage,
          s3BucketName: templateBucket,
          region: this.region,
          s3KeyPrefix: `functions/${stage}`,
          seedRoleArn: outputs.SeedRoleArn,
        });
        await lambdaUpdater.updateLambdaCode(lambdaFunctions);

        // Run post-deploy modules (admin user, custom hook)
        await this.runPostDeployModules(stage, outputs);
        break;
      }

      case "seed": {
        if (!this.config.seedDatabase) {
          logger.warning("No seed function configured for this project");
          break;
        }

        // Block prod seeding by default
        const seedDevOnly = this.config.seedDevOnly !== false;
        if (seedDevOnly && stage === "prod") {
          logger.warning("Skipping database seeding on prod (seedDevOnly: true)");
          break;
        }

        // Try to load outputs from local file first
        const outputsManagerSeed = new OutputsManager(this.projectRoot, this.appName);
        let outputs = await outputsManagerSeed.getOutputs(stage);

        if (!outputs) {
          logger.info("No local outputs file found, fetching from AWS...");
          const stackManager = new StackManager({
            logger,
            stackName,
            region: this.region,
            templateUrl: `https://${templateBucket}.s3.${this.region}.amazonaws.com/cfn-template.yaml`,
            parameters: [],
            cfnRoleArn,
          });
          outputs = await stackManager.getStackOutputs();
          await outputsManagerSeed.saveOutputs(stage, stackName, this.region, outputs);
        }

        await this.config.seedDatabase(outputs, stage);
        break;
      }

      case "remove": {
        await removeStack({
          stackName,
          region: this.region,
          appName: this.appName,
          stage: stage,
          forceWithUsers: false, // Always prompt for user confirmation
          skipConfirmation: false,
          logger,
          testUserPattern: this.config.testUserPattern,
        });
        break;
      }

      case "full": {
        // Run pre-deploy modules (certificate, SES, custom hook)
        await this.runPreDeployModules(stage);

        schemaBuildHash = await schemaManager.mergeAndUploadSchema();
        templateBuildHash = await templateUploader.uploadTemplates();
        const lambdaFunctions = await lambdaCompiler.compileAndUploadLambdas();
        resolversBuildHash = await resolverCompiler.compileAndUploadResolvers();

        let stackParameters = this.config.getStackParameters(stage, {
          resolvers: resolversBuildHash,
          schema: schemaBuildHash,
          templates: templateBuildHash,
        });

        // Inject certificate ARN if configured
        stackParameters = this.injectCertificateParam(stackParameters);

        const stackManager = new StackManager({
          logger,
          stackName,
          region: this.region,
          templateUrl: `https://${templateBucket}.s3.${this.region}.amazonaws.com/cfn-template.yaml`,
          parameters: stackParameters,
          cfnRoleArn,
        });

        await stackManager.deployStack();
        const outputs = await stackManager.getStackOutputs();
        logger.info("Stack Outputs:\n" + JSON.stringify(outputs, null, 2));

        // Save outputs to local file for easy access
        const outputsManagerFull = new OutputsManager(this.projectRoot, this.appName);
        await outputsManagerFull.saveOutputs(stage, stackName, this.region, outputs);
        logger.success(`Outputs saved to: ${outputsManagerFull.getFilePath()}`);

        // Create new compiler with seedRoleArn for Lambda updates
        const lambdaUpdater = new LambdaCompiler({
          logger,
          projectRoot: this.projectRoot,
          appName: this.appName,
          stage: stage,
          s3BucketName: templateBucket,
          region: this.region,
          s3KeyPrefix: `functions/${stage}`,
          seedRoleArn: outputs.SeedRoleArn,
        });
        await lambdaUpdater.updateLambdaCode(lambdaFunctions);

        // Apply project-specific overrides if provided
        const cognitoDomain = this.config.getCognitoDomain
          ? this.config.getCognitoDomain(stage, outputs)
          : outputs.CognitoDomain || "";

        const frontendUrl = this.config.getFrontendUrl
          ? this.config.getFrontendUrl(stage, outputs)
          : `https://${outputs.CloudFrontDomainName || ""}`;

        const frontendDeployment = new FrontendDeployment({
          logger,
          projectRoot: this.projectRoot,
          appName: this.appName,
          stage: stage,
          region: this.region,
          stackOutputs: { ...outputs, CognitoDomain: cognitoDomain },
          frontendUrl,
          envVars: this.config.getFrontendEnvVars
            ? this.config.getFrontendEnvVars(stage, outputs)
            : {},
        });

        await frontendDeployment.buildFrontend();
        await frontendDeployment.deployFrontend();

        // Seed database if configured (dev only by default)
        if (this.config.seedDatabase) {
          const seedDevOnly = this.config.seedDevOnly !== false;
          if (seedDevOnly && stage === "prod") {
            logger.info("Skipping database seeding on prod");
          } else {
            logger.info("Running database seed...");
            await this.config.seedDatabase(outputs, stage);
          }
        }

        // Run post-deploy modules (admin user, custom hook)
        await this.runPostDeployModules(stage, outputs);
        break;
      }

      case "exit":
        logger.info("Deployment cancelled.");
        process.exit(0);
    }
  }

  /**
   * Print help message
   */
  private printHelp(): void {
    const stages = this.config.stages.map((s) => s.stage).join("|");

    console.log(`
${this.appName.toUpperCase()} Deployment

Usage: yarn deploy [options]

Options:
  --stage <${stages}>     Target stage (skips interactive selection)
  --action <action>        Deployment action (skips interactive selection)
  -y, --yes                Skip all confirmation prompts
  -h, --help               Show this help message

Actions:
  orphans    Check for and clean orphaned resources (RUN FIRST after failed deploys!)
  full       Deploy everything (infrastructure + frontend)
  frontend   Build and deploy frontend only
  lambdas    Compile and update Lambda functions only
  schema     Merge and upload GraphQL schema only
  resolvers  Compile and upload AppSync resolvers only
  stack      Update CloudFormation infrastructure
  seed       Populate database with test data
  remove     Delete all resources (requires confirmation)

Examples:
  yarn deploy                           # Interactive mode
  yarn deploy --stage dev --action full # Full deploy to dev (still prompts for confirmation)
  yarn deploy --stage dev --action full -y  # Full deploy to dev, no prompts
  yarn deploy --stage prod --action orphans -y  # Clean orphans before retry
`);
  }

  /**
   * Main entry point - run the deployment
   */
  public async run(): Promise<void> {
    // Parse CLI arguments
    const cliArgs = parseCliArgs();

    // Handle --help
    if (cliArgs.help) {
      this.printHelp();
      process.exit(0);
    }

    // Set up logging
    const logDir = path.join(this.projectRoot, ".cache", "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.cleanupOldFiles(
      logDir,
      new RegExp(`^deploy-${this.appName}-.*\\.log$`),
      0
    );

    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];

    console.log(`\n${"=".repeat(60)}`);
    console.log(`${this.appName.toUpperCase()} Deployment`);
    console.log(`${"=".repeat(60)}\n`);

    try {
      // Check AWS credentials
      logger.info("Checking AWS credentials...");
      const { valid } = await this.bootstrapChecker.checkCredentials();

      if (!valid) {
        if (cliArgs.yes) {
          logger.error("AWS credentials not valid. Cannot proceed in non-interactive mode.");
          process.exit(1);
        }
        const success = await this.bootstrapChecker.promptForCredentials();
        if (!success) {
          process.exit(1);
        }
      } else {
        logger.success("AWS credentials OK");
      }

      // Determine stage (from CLI or interactive)
      let stage: TStage;
      if (cliArgs.stage) {
        // Validate provided stage
        const validStage = this.config.stages.find(
          (s) => s.stage === cliArgs.stage
        );
        if (!validStage) {
          const validStages = this.config.stages.map((s) => s.stage).join(", ");
          logger.error(
            `Invalid stage: ${cliArgs.stage}. Valid stages: ${validStages}`
          );
          process.exit(1);
        }
        stage = validStage.stage;
        logger.info(`Stage: ${stage} (from CLI)`);
      } else {
        const menuSystem = new MenuSystem();
        stage = await menuSystem.showStageSelection(this.config.stages);
      }

      console.log(`\n${"=".repeat(60)}`);
      console.log(`Stage: ${stage.toUpperCase()}`);
      console.log(`${"=".repeat(60)}\n`);

      // Determine action (from CLI or interactive)
      let deployOption: DeployOption;
      if (cliArgs.action) {
        // Validate provided action
        const validActions: DeployOption[] = [
          "orphans",
          "full",
          "frontend",
          "lambdas",
          "schema",
          "resolvers",
          "stack",
          "seed",
          "remove",
          "exit",
        ];
        if (!validActions.includes(cliArgs.action)) {
          logger.error(
            `Invalid action: ${cliArgs.action}. Valid actions: ${validActions.join(", ")}`
          );
          process.exit(1);
        }
        deployOption = cliArgs.action;
        logger.info(`Action: ${deployOption} (from CLI)`);
      } else {
        const menuSystem = new MenuSystem();
        deployOption = await menuSystem.show();
      }

      // Confirm dangerous operations unless -y is provided
      if (deployOption === "remove" && !cliArgs.yes) {
        // removeStack has its own confirmation
      }

      // Check bootstrap resources
      if (
        deployOption !== "orphans" &&
        deployOption !== "frontend" &&
        deployOption !== "seed" &&
        deployOption !== "exit" &&
        deployOption !== "remove"
      ) {
        logger.info("Checking bootstrap resources...");
        const bootstrap = await this.bootstrapChecker.checkBootstrapResources();

        if (!bootstrap.ready) {
          this.bootstrapChecker.printBootstrapInstructions(bootstrap);
          process.exit(1);
        }
        logger.success("Bootstrap resources OK");
      }

      // Set up log file
      const logFile = path.join(
        logDir,
        `deploy-${this.appName}-${stage}-${deployOption}-${timestamp}.log`
      );
      setLogFile(logFile);
      logger.info(`Logging to: ${logFile}`);

      console.log(`\nExecuting: ${deployOption}\n`);

      await this.executeDeployment(deployOption, stage);

      console.log("\n" + "=".repeat(60));
      console.log("Deployment complete!");
      console.log("=".repeat(60) + "\n");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`\nDeployment failed: ${errorMessage}`);
      if (errorStack) {
        logger.debug(`Stack trace:\n${errorStack}`);
      }
      closeLogFile();
      process.exit(1);
    } finally {
      closeLogFile();
    }
  }
}
