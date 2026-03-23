/**
 * Cognito Admin User Module
 *
 * Creates an admin user in Cognito User Pool.
 * Supports adding to groups and setting custom attributes.
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  CreateGroupCommand,
  ListGroupsCommand,
  type AttributeType,
  type GroupType,
} from "@aws-sdk/client-cognito-identity-provider";
import { Logger } from "../types";

export interface CognitoAdminUserConfig {
  /** Enable admin user creation */
  enabled: boolean;
  /** Admin email (defaults to ADMIN_EMAIL env var) */
  adminEmail?: string;
  /** Group to add admin to (e.g., "admin", "admins") */
  adminGroup?: string;
  /** All groups that should exist in the user pool */
  requiredGroups?: string[];
  /** Custom attributes to set on the user */
  customAttributes?: Record<string, string>;
  /** Default password for the admin user */
  defaultPassword?: string;
}

export interface CognitoAdminUserParams {
  userPoolId: string;
  region: string;
  logger: Logger;
}

export interface CognitoAdminUserResult {
  userId?: string;
  email?: string;
  created: boolean;
}

const DEFAULT_PASSWORD = "Temp1234!";

/**
 * Create admin user in Cognito
 */
export async function createCognitoAdminUser(
  params: CognitoAdminUserParams,
  config: CognitoAdminUserConfig
): Promise<CognitoAdminUserResult> {
  if (!config.enabled) {
    return { created: false };
  }

  const adminEmail = config.adminEmail || process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    params.logger.info("Skipping admin user creation (no email provided)");
    return { created: false };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    params.logger.warning(`Invalid admin email format: ${adminEmail}`);
    return { created: false };
  }

  params.logger.info("\nSetting up admin user...");

  const cognitoClient = new CognitoIdentityProviderClient({ region: params.region });
  const { userPoolId, logger } = params;

  // Ensure required groups exist
  if (config.requiredGroups?.length) {
    await ensureGroups(cognitoClient, userPoolId, config.requiredGroups, logger);
  }

  // Check if user already exists
  let userId: string | undefined;
  let userExists = false;

  try {
    const response = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: adminEmail,
      })
    );

    userId = response.UserAttributes?.find((attr: AttributeType) => attr.Name === "sub")?.Value;
    userExists = true;
    logger.info(`  Admin user already exists: ${adminEmail}`);
  } catch (error: any) {
    if (error.name !== "UserNotFoundException" && error.__type !== "UserNotFoundException") {
      throw error;
    }
  }

  // Create user if doesn't exist
  if (!userExists) {
    const password = config.defaultPassword || DEFAULT_PASSWORD;

    const userAttributes = [
      { Name: "email", Value: adminEmail },
      { Name: "email_verified", Value: "true" },
    ];

    // Add custom attributes
    if (config.customAttributes) {
      for (const [name, value] of Object.entries(config.customAttributes)) {
        userAttributes.push({ Name: name, Value: value });
      }
    }

    logger.info(`  Creating admin user: ${adminEmail}`);

    const createResponse = await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: adminEmail,
        TemporaryPassword: password,
        UserAttributes: userAttributes,
        MessageAction: "SUPPRESS",
      })
    );

    userId = createResponse.User?.Attributes?.find((attr: AttributeType) => attr.Name === "sub")?.Value;

    // Set permanent password
    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: adminEmail,
        Password: password,
        Permanent: true,
      })
    );

    logger.success(`  Admin user created with password: ${password}`);
  }

  // Add to admin group
  if (config.adminGroup && userId) {
    try {
      await cognitoClient.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: adminEmail,
          GroupName: config.adminGroup,
        })
      );
      logger.info(`  Added to group: ${config.adminGroup}`);
    } catch (error: any) {
      // Ignore if already in group
      if (!error.message?.includes("already in group")) {
        throw error;
      }
    }
  }

  return {
    userId,
    email: adminEmail,
    created: !userExists,
  };
}

/**
 * Ensure all required groups exist in user pool
 */
async function ensureGroups(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  requiredGroups: string[],
  logger: Logger
): Promise<void> {
  const response = await client.send(new ListGroupsCommand({ UserPoolId: userPoolId }));
  const existingGroups = response.Groups?.map((g: GroupType) => g.GroupName) || [];

  for (const groupName of requiredGroups) {
    if (!existingGroups.includes(groupName)) {
      logger.info(`  Creating group: ${groupName}`);
      await client.send(
        new CreateGroupCommand({
          UserPoolId: userPoolId,
          GroupName: groupName,
          Description: `Auto-created ${groupName} group`,
        })
      );
    }
  }
}
