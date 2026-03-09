/**
 * Stack Outputs Manager
 *
 * ⚠️ CRITICAL: Used by ALL projects! Test changes across all integrated projects.
 *
 * Saves and retrieves CloudFormation stack outputs to/from a local JSON file.
 * This avoids needing to query AWS for outputs after deployment.
 *
 * ## Why This Exists
 *
 * After CloudFormation deployment, stack outputs (UserPoolId, ApiUrl, etc.) are
 * needed for:
 * - Frontend builds (environment variables)
 * - Lambda updates (SeedRoleArn)
 * - Seeding databases
 * - Debugging/inspection
 *
 * Without this, every operation requires an AWS API call to fetch outputs.
 * With this, outputs are saved locally and subsequent operations are instant.
 *
 * ## File Location
 *
 * Outputs are saved to: `<projectRoot>/deploy/deployment-outputs.json`
 *
 * ## File Format
 *
 * ```json
 * {
 *   "appName": "helpstay",
 *   "stages": {
 *     "dev": {
 *       "lastUpdated": "2026-03-09T07:00:00.000Z",
 *       "stackName": "helpstay-dev",
 *       "region": "ap-southeast-2",
 *       "outputs": {
 *         "UserPoolId": "ap-southeast-2_xxx",
 *         "ApiUrl": "https://xxx.appsync-api.ap-southeast-2.amazonaws.com/graphql"
 *       },
 *       "rawOutputs": [...]
 *     },
 *     "prod": { ... }
 *   }
 * }
 * ```
 *
 * ## Usage in Orchestrator
 *
 * The DeploymentOrchestrator automatically:
 * 1. Saves outputs after "stack" or "full" deployments
 * 2. Reads outputs from file for "frontend", "lambdas", "seed" operations
 * 3. Falls back to AWS API if file doesn't exist
 *
 * ## Git Considerations
 *
 * You may want to add `deploy/deployment-outputs.json` to .gitignore if:
 * - You have different AWS accounts per developer
 * - Outputs contain sensitive information
 *
 * Or commit it if:
 * - CI/CD needs cached outputs for frontend-only deployments
 * - You want to track deployed resource IDs in version control
 *
 * @see /home/liqk1ugzoezh5okwywlr_/dev/shared/deploy-utils/README.md
 */

import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";

export interface StackOutput {
  OutputKey: string;
  OutputValue: string;
  Description?: string;
  ExportName?: string;
}

export interface StageOutputs {
  lastUpdated: string;
  stackName: string;
  region: string;
  outputs: Record<string, string>;
  rawOutputs: StackOutput[];
}

export interface DeploymentOutputsFile {
  appName: string;
  stages: Record<string, StageOutputs>;
}

export class OutputsManager {
  private outputsFilePath: string;
  private appName: string;

  constructor(projectRoot: string, appName: string) {
    this.outputsFilePath = join(projectRoot, "deploy", "deployment-outputs.json");
    this.appName = appName;
  }

  /**
   * Save stack outputs after deployment
   * Accepts either Record<string, string> (from StackManager.getStackOutputs())
   * or StackOutput[] (raw CloudFormation outputs)
   */
  async saveOutputs(
    stage: string,
    stackName: string,
    region: string,
    outputs: Record<string, string> | StackOutput[]
  ): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.outputsFilePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Load existing file or create new
    let deploymentOutputs: DeploymentOutputsFile;
    try {
      const content = await readFile(this.outputsFilePath, "utf8");
      deploymentOutputs = JSON.parse(content);
    } catch {
      deploymentOutputs = {
        appName: this.appName,
        stages: {},
      };
    }

    // Handle both input formats
    let outputsMap: Record<string, string>;
    let rawOutputs: StackOutput[];

    if (Array.isArray(outputs)) {
      // StackOutput[] format
      outputsMap = {};
      for (const output of outputs) {
        if (output.OutputKey && output.OutputValue) {
          outputsMap[output.OutputKey] = output.OutputValue;
        }
      }
      rawOutputs = outputs;
    } else {
      // Record<string, string> format (from StackManager)
      outputsMap = outputs;
      rawOutputs = Object.entries(outputs).map(([key, value]) => ({
        OutputKey: key,
        OutputValue: value,
      }));
    }

    // Update stage outputs
    deploymentOutputs.stages[stage] = {
      lastUpdated: new Date().toISOString(),
      stackName,
      region,
      outputs: outputsMap,
      rawOutputs,
    };

    // Save file
    await writeFile(
      this.outputsFilePath,
      JSON.stringify(deploymentOutputs, null, 2)
    );
  }

  /**
   * Get all outputs for a stage
   */
  async getOutputs(stage: string): Promise<Record<string, string> | null> {
    try {
      const content = await readFile(this.outputsFilePath, "utf8");
      const deploymentOutputs: DeploymentOutputsFile = JSON.parse(content);
      return deploymentOutputs.stages[stage]?.outputs || null;
    } catch {
      return null;
    }
  }

  /**
   * Get a specific output value
   */
  async getOutputValue(stage: string, key: string): Promise<string | null> {
    const outputs = await this.getOutputs(stage);
    return outputs?.[key] || null;
  }

  /**
   * Get full stage info including metadata
   */
  async getStageInfo(stage: string): Promise<StageOutputs | null> {
    try {
      const content = await readFile(this.outputsFilePath, "utf8");
      const deploymentOutputs: DeploymentOutputsFile = JSON.parse(content);
      return deploymentOutputs.stages[stage] || null;
    } catch {
      return null;
    }
  }

  /**
   * Clear outputs for a stage (used when stack is deleted)
   */
  async clearOutputs(stage: string): Promise<void> {
    try {
      const content = await readFile(this.outputsFilePath, "utf8");
      const deploymentOutputs: DeploymentOutputsFile = JSON.parse(content);

      if (deploymentOutputs.stages[stage]) {
        delete deploymentOutputs.stages[stage];
        await writeFile(
          this.outputsFilePath,
          JSON.stringify(deploymentOutputs, null, 2)
        );
      }
    } catch {
      // File doesn't exist, nothing to clear
    }
  }

  /**
   * Check if outputs file exists
   */
  exists(): boolean {
    return existsSync(this.outputsFilePath);
  }

  /**
   * Get the path to the outputs file
   */
  getFilePath(): string {
    return this.outputsFilePath;
  }
}
