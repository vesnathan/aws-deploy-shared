/**
 * Shared Cognito Lambda Types
 */

/**
 * Supported OAuth providers
 */
export type OAuthProvider = "Google";

/**
 * Error codes thrown by Pre-SignUp trigger
 */
export type AccountConflictError =
  | "NATIVE_ACCOUNT_EXISTS"
  | "GOOGLE_ACCOUNT_EXISTS";

/**
 * Pre-SignUp Lambda configuration
 */
export interface PreSignUpConfig {
  /** OAuth providers to check for conflicts */
  oauthProviders: OAuthProvider[];
  /** Auto-verify email for OAuth sign-ups (default: true) */
  autoVerifyOAuthEmail?: boolean;
  /** Auto-confirm OAuth users (default: true) */
  autoConfirmOAuthUsers?: boolean;
}
