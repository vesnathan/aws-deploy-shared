/**
 * Shared Pre-SignUp Lambda Factory
 *
 * Creates a Cognito Pre-SignUp trigger handler that:
 * 1. Prevents native sign-up when Google account exists (throws GOOGLE_ACCOUNT_EXISTS)
 * 2. Prevents Google sign-up when native account exists (throws NATIVE_ACCOUNT_EXISTS)
 * 3. Auto-verifies email for Google OAuth users (trusted provider)
 *
 * Frontend should catch these errors and show appropriate messages:
 * - "An account with this email exists. Please sign in with Google instead."
 * - "An account with this email exists. Please sign in with email/password instead."
 */

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
  PreSignUpTriggerEvent,
  PreSignUpTriggerHandler,
} from "aws-lambda";
import type { PreSignUpConfig, OAuthProvider, AccountConflictError } from "./types";

/**
 * Map provider to username prefix (case-insensitive)
 */
const PROVIDER_PREFIXES: Record<OAuthProvider, string[]> = {
  Google: ["google_", "Google_"],
};

/**
 * Map provider to error code
 */
const PROVIDER_ERRORS: Record<OAuthProvider, AccountConflictError> = {
  Google: "GOOGLE_ACCOUNT_EXISTS",
};

/**
 * Check if a username matches a provider prefix
 */
function matchesProvider(username: string, provider: OAuthProvider): boolean {
  const lowerUsername = username.toLowerCase();
  const prefixes = PROVIDER_PREFIXES[provider];
  return prefixes.some((prefix) => lowerUsername.startsWith(prefix.toLowerCase()));
}

/**
 * Check if a username is a federated (OAuth) user
 */
function isFederatedUser(username: string): boolean {
  const lowerUsername = username.toLowerCase();
  return lowerUsername.startsWith("google_");
}

/**
 * Create a Pre-SignUp Lambda handler
 *
 * @example
 * // In your Lambda file:
 * import { createPreSignUpHandler } from "@vesnathan/aws-deploy-shared/cognito";
 *
 * export const handler = createPreSignUpHandler({
 *   oauthProviders: ["Google"],
 * });
 */
export function createPreSignUpHandler(config: PreSignUpConfig): PreSignUpTriggerHandler {
  const cognitoClient = new CognitoIdentityProviderClient({});
  const autoVerify = config.autoVerifyOAuthEmail ?? true;
  const autoConfirm = config.autoConfirmOAuthUsers ?? true;

  return async (event: PreSignUpTriggerEvent) => {
    console.log("PreSignUp trigger:", JSON.stringify(event, null, 2));

    const { triggerSource, request, userPoolId } = event;
    const email = request.userAttributes.email;

    // Handle native sign-ups - check if OAuth account exists
    if (triggerSource === "PreSignUp_SignUp") {
      try {
        const existingUsers = await cognitoClient.send(
          new ListUsersCommand({
            UserPoolId: userPoolId,
            Filter: `email = "${email}"`,
            Limit: 10,
          })
        );

        console.log(
          "Checking for OAuth accounts:",
          JSON.stringify(existingUsers.Users, null, 2)
        );

        // Check each configured provider
        for (const provider of config.oauthProviders) {
          const oauthUser = existingUsers.Users?.find((user) =>
            matchesProvider(user.Username || "", provider)
          );

          if (oauthUser) {
            console.log(`Found existing ${provider} user:`, oauthUser.Username);
            throw new Error(PROVIDER_ERRORS[provider]);
          }
        }
      } catch (error: unknown) {
        // Re-throw our custom errors
        if (
          error instanceof Error &&
          error.message === "GOOGLE_ACCOUNT_EXISTS"
        ) {
          throw error;
        }
        console.error("Error checking for OAuth accounts:", error);
        // Don't block signup on errors - let normal flow proceed
      }

      return event;
    }

    // Only process external provider sign-ups below this point
    if (triggerSource !== "PreSignUp_ExternalProvider") {
      return event;
    }

    // This is an OAuth sign-up
    // Check if a native user with this email already exists
    try {
      const existingUsers = await cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${email}"`,
          Limit: 10,
        })
      );

      console.log(
        "Existing users with email:",
        JSON.stringify(existingUsers.Users, null, 2)
      );

      // Find native Cognito user (not a federated user)
      const nativeUser = existingUsers.Users?.find((user) => {
        const username = user.Username || "";
        return !isFederatedUser(username);
      });

      if (nativeUser) {
        console.log("Found existing native user:", nativeUser.Username);
        throw new Error("NATIVE_ACCOUNT_EXISTS");
      }

      // No existing native user - allow OAuth sign-up
      // Auto-verify email since it comes from a trusted provider
      if (autoVerify) {
        event.response.autoVerifyEmail = true;
      }
      if (autoConfirm) {
        event.response.autoConfirmUser = true;
      }

      return event;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "NATIVE_ACCOUNT_EXISTS") {
        throw error;
      }
      console.error("Error in PreSignUp trigger:", error);
      // Don't block sign-up on errors - let it proceed
      if (autoVerify) {
        event.response.autoVerifyEmail = true;
      }
      if (autoConfirm) {
        event.response.autoConfirmUser = true;
      }
      return event;
    }
  };
}
