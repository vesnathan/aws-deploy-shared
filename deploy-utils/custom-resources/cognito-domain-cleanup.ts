/**
 * Cognito Domain Cleanup Custom Resource Handler
 *
 * CloudFormation Custom Resource that deletes Cognito User Pool domains before
 * User Pool deletion. User Pools with configured domains cannot be deleted by
 * CloudFormation until the domain is removed.
 *
 * Usage in CloudFormation:
 * - Create a Lambda function with this handler
 * - Create a Custom Resource that references the User Pool
 * - CloudFormation will call this before deleting the User Pool
 */

import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  DeleteUserPoolDomainCommand,
  ListIdentityProvidersCommand,
  DeleteIdentityProviderCommand,
} from "@aws-sdk/client-cognito-identity-provider";

interface CloudFormationCustomResourceEvent {
  RequestType: "Create" | "Update" | "Delete";
  ServiceToken: string;
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceProperties: {
    UserPoolId: string;
    ServiceToken: string;
  };
  OldResourceProperties?: Record<string, unknown>;
}

interface CloudFormationResponse {
  Status: "SUCCESS" | "FAILED";
  Reason?: string;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data?: Record<string, unknown>;
}

/**
 * Lambda handler for Cognito domain cleanup Custom Resource
 */
export async function handler(
  event: CloudFormationCustomResourceEvent
): Promise<void> {
  console.log("Cognito Domain Cleanup Event:", JSON.stringify(event, null, 2));

  const userPoolId = event.ResourceProperties.UserPoolId;
  const physicalResourceId =
    event.PhysicalResourceId || `cognito-cleanup-${userPoolId}`;

  try {
    // Only clean up on Delete - Create and Update are no-ops
    if (event.RequestType === "Delete") {
      console.log(`Cleaning up Cognito User Pool: ${userPoolId}`);
      await cleanupUserPool(userPoolId);
      console.log(`Successfully cleaned up Cognito User Pool: ${userPoolId}`);
    } else {
      console.log(`${event.RequestType} - no action required`);
    }

    await sendResponse(event, {
      Status: "SUCCESS",
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: { UserPoolId: userPoolId },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);

    // For Delete, we succeed even on error to not block stack deletion
    // The user pool might already be deleted or not exist
    if (event.RequestType === "Delete") {
      console.log("Reporting SUCCESS despite error (Delete operation)");
      await sendResponse(event, {
        Status: "SUCCESS",
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Reason: `Cleanup completed with warning: ${errorMessage}`,
      });
    } else {
      await sendResponse(event, {
        Status: "FAILED",
        Reason: errorMessage,
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
      });
    }
  }
}

/**
 * Clean up a Cognito User Pool (delete domain and identity providers)
 */
async function cleanupUserPool(userPoolId: string): Promise<void> {
  const cognitoClient = new CognitoIdentityProviderClient({});

  // Step 1: Delete identity providers (e.g., Google OAuth)
  // These must be deleted before the domain, and can cause issues with secret resolution
  try {
    console.log("Listing identity providers...");
    const providersResponse = await cognitoClient.send(
      new ListIdentityProvidersCommand({
        UserPoolId: userPoolId,
        MaxResults: 60,
      })
    );

    for (const provider of providersResponse.Providers || []) {
      if (provider.ProviderName) {
        console.log(`Deleting identity provider: ${provider.ProviderName}`);
        try {
          await cognitoClient.send(
            new DeleteIdentityProviderCommand({
              UserPoolId: userPoolId,
              ProviderName: provider.ProviderName,
            })
          );
          console.log(`Deleted identity provider: ${provider.ProviderName}`);
        } catch (error: unknown) {
          const err = error as { name?: string; message?: string };
          console.warn(
            `Failed to delete identity provider ${provider.ProviderName}: ${err.message}`
          );
          // Continue with other providers
        }
      }
    }
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "ResourceNotFoundException") {
      console.log("User Pool does not exist - nothing to clean");
      return;
    }
    console.warn(`Failed to list identity providers: ${err.message}`);
    // Continue to try deleting the domain
  }

  // Step 2: Get User Pool details to find domain
  try {
    console.log("Describing User Pool...");
    const describeResponse = await cognitoClient.send(
      new DescribeUserPoolCommand({ UserPoolId: userPoolId })
    );

    const domain = describeResponse.UserPool?.Domain;
    const customDomain = describeResponse.UserPool?.CustomDomain;

    // Step 3: Delete domain if configured
    const domainToDelete = customDomain || domain;
    if (domainToDelete) {
      console.log(`Deleting domain: ${domainToDelete}`);
      try {
        await cognitoClient.send(
          new DeleteUserPoolDomainCommand({
            UserPoolId: userPoolId,
            Domain: domainToDelete,
          })
        );
        console.log(`Deleted domain: ${domainToDelete}`);
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };
        // Domain might already be deleted
        if (
          err.name === "ResourceNotFoundException" ||
          err.message?.includes("does not exist")
        ) {
          console.log(`Domain ${domainToDelete} already deleted`);
        } else {
          throw error;
        }
      }
    } else {
      console.log("No domain configured on User Pool");
    }
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "ResourceNotFoundException") {
      console.log("User Pool does not exist - nothing to clean");
      return;
    }
    throw error;
  }
}

/**
 * Send response to CloudFormation
 */
async function sendResponse(
  event: CloudFormationCustomResourceEvent,
  response: CloudFormationResponse
): Promise<void> {
  const responseBody = JSON.stringify(response);

  console.log("Sending response:", responseBody);

  const parsedUrl = new URL(event.ResponseURL);

  const requestOptions: RequestInit = {
    method: "PUT",
    body: responseBody,
    headers: {
      "Content-Type": "",
      "Content-Length": String(Buffer.byteLength(responseBody)),
    },
  };

  try {
    const fetchResponse = await fetch(parsedUrl.toString(), requestOptions);
    console.log(`Response status: ${fetchResponse.status}`);
  } catch (error) {
    console.error("Error sending response:", error);
    throw error;
  }
}
