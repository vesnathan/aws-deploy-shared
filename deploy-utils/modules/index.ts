/**
 * Deploy Utils Modules
 *
 * Reusable deployment modules for common AWS patterns.
 */

export {
  deployCertificateStack,
  type CertificateStackConfig,
  type CertificateStackParams,
  type CertificateStackOutputs,
} from "./certificate-stack";

export {
  deploySesEmailStack,
  type SesEmailStackConfig,
  type SesEmailStackParams,
} from "./ses-email-stack";

export {
  createCognitoAdminUser,
  type CognitoAdminUserConfig,
  type CognitoAdminUserParams,
  type CognitoAdminUserResult,
} from "./cognito-admin-user";

export {
  seedDatabase,
  type SeedDatabaseConfig,
  type SeedDatabaseParams,
  type SeedItem,
} from "./seed-database";
