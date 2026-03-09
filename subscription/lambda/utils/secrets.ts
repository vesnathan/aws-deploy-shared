/**
 * Secrets Manager utilities for Lambda functions
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * Stripe secrets structure
 */
export interface StripeSecrets {
  secretKey: string;
  webhookSecret: string;
  publishableKey?: string;
  [key: string]: string | undefined; // For dynamic price ID keys
}

// Cache for secrets (keyed by ARN)
const secretsCache: Record<string, StripeSecrets> = {};

/**
 * Create a secrets manager for a specific region
 */
export function createSecretsManager(region: string) {
  const client = new SecretsManagerClient({ region });

  /**
   * Get Stripe secrets from Secrets Manager
   */
  async function getStripeSecrets(
    secretsEnvVar: string,
    testSecretsEnvVar?: string,
    isTestMode: boolean = false,
  ): Promise<StripeSecrets> {
    const envVar = isTestMode && testSecretsEnvVar ? testSecretsEnvVar : secretsEnvVar;
    const secretArn = process.env[envVar];

    if (!secretArn) {
      throw new Error(
        `${envVar} not configured. ${isTestMode ? "Test mode" : "Production"} secrets required.`,
      );
    }

    // Check cache
    if (secretsCache[secretArn]) {
      return secretsCache[secretArn];
    }

    console.log(`Fetching Stripe secrets (${isTestMode ? "test" : "production"} mode)`);

    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn }),
    );

    if (!response.SecretString) {
      throw new Error("Stripe secrets not found in Secrets Manager");
    }

    const secrets = JSON.parse(response.SecretString) as StripeSecrets;
    secretsCache[secretArn] = secrets;

    return secrets;
  }

  /**
   * Clear the secrets cache (useful for testing)
   */
  function clearCache(): void {
    Object.keys(secretsCache).forEach((key) => {
      delete secretsCache[key];
    });
  }

  return {
    getStripeSecrets,
    clearCache,
  };
}
