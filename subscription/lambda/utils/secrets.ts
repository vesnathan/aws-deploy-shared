/**
 * Secrets Manager utilities for Lambda functions
 *
 * Secrets are split into two:
 * 1. Account-level keys (stripe-account-keys): API keys shared across all apps
 * 2. App-specific secrets (e.g., helpstay-stripe): webhook secrets, price IDs
 *
 * Keys use consistent naming:
 * - STRIPE_LIVE_* for production
 * - STRIPE_TEST_* for development/testing
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * Stripe secrets structure (normalized for use)
 */
export interface StripeSecrets {
  secretKey: string;
  webhookSecret: string;
  publishableKey?: string;
  [key: string]: string | undefined; // For dynamic price ID keys
}

/**
 * Raw secrets from Secrets Manager
 */
interface RawSecrets {
  [key: string]: string | undefined;
}

// Cache for merged secrets (keyed by combined ARNs + mode)
const secretsCache: Record<string, StripeSecrets> = {};

/**
 * Create a secrets manager for a specific region
 */
export function createSecretsManager(region: string) {
  const client = new SecretsManagerClient({ region });

  /**
   * Fetch a secret from Secrets Manager
   */
  async function fetchSecret(secretArn: string): Promise<RawSecrets> {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn }),
    );

    if (!response.SecretString) {
      throw new Error(`Secret not found: ${secretArn}`);
    }

    return JSON.parse(response.SecretString) as RawSecrets;
  }

  /**
   * Get Stripe secrets from Secrets Manager
   *
   * Fetches from two secrets:
   * 1. Account keys (shared across apps): API keys
   * 2. App secrets (per app): webhook secrets, price IDs
   *
   * Returns normalized secrets based on mode (live/test)
   */
  async function getStripeSecrets(
    accountKeysEnvVar: string,
    appSecretsEnvVar: string,
    isTestMode: boolean = false,
  ): Promise<StripeSecrets> {
    const accountKeysArn = process.env[accountKeysEnvVar];
    const appSecretsArn = process.env[appSecretsEnvVar];

    if (!accountKeysArn) {
      throw new Error(`${accountKeysEnvVar} not configured`);
    }
    if (!appSecretsArn) {
      throw new Error(`${appSecretsEnvVar} not configured`);
    }

    // Cache key includes both ARNs and mode
    const cacheKey = `${accountKeysArn}:${appSecretsArn}:${isTestMode ? "test" : "live"}`;

    if (secretsCache[cacheKey]) {
      return secretsCache[cacheKey];
    }

    const mode = isTestMode ? "test" : "live";
    console.log(`Fetching Stripe secrets (${mode} mode)`);

    // Fetch both secrets in parallel
    const [accountKeys, appSecrets] = await Promise.all([
      fetchSecret(accountKeysArn),
      fetchSecret(appSecretsArn),
    ]);

    // Determine prefix based on mode
    const prefix = isTestMode ? "STRIPE_TEST_" : "STRIPE_LIVE_";

    // Extract keys based on mode
    const secrets: StripeSecrets = {
      secretKey: accountKeys[`${prefix}SECRET_KEY`] ?? "",
      publishableKey: accountKeys[`${prefix}PUBLISHABLE_KEY`],
      webhookSecret: appSecrets[`${prefix}WEBHOOK_SECRET`] ?? "",
    };

    // Extract price IDs from app secrets
    // e.g., STRIPE_LIVE_BASIC_PRICE_ID -> STRIPE_BASIC_PRICE_ID
    for (const [key, value] of Object.entries(appSecrets)) {
      if (key.startsWith(prefix) && key.endsWith("_PRICE_ID")) {
        // Normalize to STRIPE_*_PRICE_ID format (without LIVE/TEST)
        const normalizedKey = key.replace(prefix, "STRIPE_");
        secrets[normalizedKey] = value;
      }
    }

    secretsCache[cacheKey] = secrets;
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
