/**
 * Shared Cognito Lambda Factories
 *
 * Pre-SignUp: Handle account conflicts between native and OAuth
 * Post-Confirmation: Create minimal user profile in DynamoDB
 *
 * @example
 * // Pre-SignUp Lambda
 * import { createPreSignUpHandler } from "@vesnathan/aws-deploy-shared/cognito";
 * export const handler = createPreSignUpHandler({ oauthProviders: ["Google"] });
 *
 * @example
 * // Post-Confirmation Lambda
 * import { createPostConfirmationHandler } from "@vesnathan/aws-deploy-shared/cognito";
 * export const handler = createPostConfirmationHandler();
 */

export type {
  OAuthProvider,
  AccountConflictError,
  PreSignUpConfig,
} from "./types";

export { createPreSignUpHandler } from "./preSignUp";
export { createPostConfirmationHandler } from "./postConfirmation";
