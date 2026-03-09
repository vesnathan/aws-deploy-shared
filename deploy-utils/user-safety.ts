/**
 * User Safety Check - Cognito User Detection
 *
 * CRITICAL: This module prevents accidental deletion of stacks with active users
 * All removal operations MUST call checkCognitoUsers() before proceeding
 */

import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  STSClient,
  AssumeRoleCommand,
  type Credentials,
} from "@aws-sdk/client-sts";
import type { UserCheckResult, UserCheckOptions } from "./types";

/**
 * Check if a CloudFormation stack has active Cognito users
 *
 * @returns UserCheckResult with user count and details
 * @throws Error if Cognito query fails (blocks deletion for safety)
 */
export async function checkCognitoUsers(
  options: UserCheckOptions
): Promise<UserCheckResult> {
  const { stackName, region, appName, stage, seedRoleArn } = options;

  // Step 1: Get UserPoolId from CloudFormation stack outputs
  const cfnClient = new CloudFormationClient({ region });

  let userPoolId: string | undefined;
  try {
    const describeResponse = await cfnClient.send(
      new DescribeStacksCommand({ StackName: stackName })
    );

    const outputs = describeResponse.Stacks?.[0]?.Outputs || [];
    userPoolId = outputs.find(
      (o) => o.OutputKey === "UserPoolId" || o.OutputKey === "CognitoUserPoolId"
    )?.OutputValue;
  } catch (error: any) {
    if (error.name === "ValidationError" && error.message?.includes("does not exist")) {
      // Stack doesn't exist - safe to skip
      return {
        hasUsers: false,
        userCount: 0,
        users: [],
        error: "Stack does not exist"
      };
    }
    throw error;
  }

  // Step 2: If no UserPoolId, no users possible
  if (!userPoolId) {
    return {
      hasUsers: false,
      userCount: 0,
      users: [],
      error: "No Cognito User Pool found in stack outputs"
    };
  }

  // Step 3: Query Cognito for user count
  // If seedRoleArn provided, assume role for elevated permissions
  let cognitoClient: CognitoIdentityProviderClient;

  if (seedRoleArn) {
    const stsClient = new STSClient({ region });
    try {
      const assumeRoleResponse = await stsClient.send(
        new AssumeRoleCommand({
          RoleArn: seedRoleArn,
          RoleSessionName: "user-safety-check",
          ExternalId: `${appName}-seed-${stage}`,
          DurationSeconds: 900, // 15 minutes
        })
      );

      if (!assumeRoleResponse.Credentials) {
        throw new Error("No credentials returned from AssumeRole");
      }

      cognitoClient = new CognitoIdentityProviderClient({
        region,
        credentials: {
          accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
          secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
          sessionToken: assumeRoleResponse.Credentials.SessionToken!,
        },
      });
    } catch (error: any) {
      throw new Error(
        `Failed to assume SeedRole for Cognito access: ${error.message}. ` +
        `Cannot verify user count - BLOCKING deletion for safety.`
      );
    }
  } else {
    cognitoClient = new CognitoIdentityProviderClient({ region });
  }

  let userPoolName: string | undefined;
  let estimatedUsers: number = 0;

  try {
    const poolResponse = await cognitoClient.send(
      new DescribeUserPoolCommand({ UserPoolId: userPoolId })
    );

    userPoolName = poolResponse.UserPool?.Name;
    estimatedUsers = poolResponse.UserPool?.EstimatedNumberOfUsers || 0;
  } catch (error: any) {
    // If we can't query Cognito, BLOCK deletion for safety
    throw new Error(
      `Failed to query Cognito User Pool ${userPoolId}: ${error.message}. ` +
      `Cannot verify user count - BLOCKING deletion for safety.`
    );
  }

  // Step 4: If no users, safe to proceed
  if (estimatedUsers === 0) {
    return {
      hasUsers: false,
      userCount: 0,
      users: [],
      userPoolId,
      userPoolName
    };
  }

  // Step 5: Users found - list them for display
  const users = await listAllUsers(cognitoClient, userPoolId);

  return {
    hasUsers: true,
    userCount: users.length,
    users,
    userPoolId,
    userPoolName
  };
}

/**
 * List all users in a Cognito User Pool (with pagination)
 */
async function listAllUsers(
  client: CognitoIdentityProviderClient,
  userPoolId: string
): Promise<Array<{
  email: string;
  username: string;
  created: Date;
  status: string;
}>> {
  const users: Array<{
    email: string;
    username: string;
    created: Date;
    status: string;
  }> = [];

  let paginationToken: string | undefined;

  do {
    const listResponse = await client.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: 60, // Max per page
        PaginationToken: paginationToken,
      })
    );

    const cognitoUsers = listResponse.Users || [];

    for (const user of cognitoUsers) {
      const emailAttr = user.Attributes?.find((attr) => attr.Name === "email");

      users.push({
        email: emailAttr?.Value || "no-email",
        username: user.Username || "unknown",
        created: user.UserCreateDate || new Date(),
        status: user.UserStatus || "UNKNOWN",
      });
    }

    paginationToken = listResponse.PaginationToken;
  } while (paginationToken);

  return users;
}
