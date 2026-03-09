/**
 * Route53 Record Upsert Custom Resource Handler
 *
 * CloudFormation Custom Resource that creates or updates Route53 records
 * using UPSERT semantics. This handles the case where a record already
 * exists (from a previous failed deployment or manual creation).
 *
 * Why this exists:
 * - CloudFormation's AWS::Route53::RecordSet uses CREATE by default
 * - If the record exists, CREATE fails with "record already exists"
 * - This is common after failed deployments that leave orphaned records
 *
 * This Custom Resource:
 * - On Create: UPSERT the record (creates if missing, updates if exists)
 * - On Update: UPSERT the record
 * - On Delete: DELETE the record (best effort, succeeds even if missing)
 *
 * Usage in CloudFormation:
 * ```yaml
 * AuthDomainDnsRecord:
 *   Type: Custom::Route53RecordUpsert
 *   Properties:
 *     ServiceToken: !GetAtt Route53RecordUpsertFunction.Arn
 *     HostedZoneId: !Ref HostedZoneId
 *     RecordName: auth.example.com
 *     RecordType: A
 *     AliasTarget:
 *       DNSName: d123456789.cloudfront.net
 *       HostedZoneId: Z2FDTNDATAQYW2
 *       EvaluateTargetHealth: false
 * ```
 */

import {
  Route53Client,
  ChangeResourceRecordSetsCommand,
  type Change,
  type ResourceRecordSet,
  type AliasTarget,
  type RRType,
} from "@aws-sdk/client-route-53";

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
    ServiceToken: string;
    HostedZoneId: string;
    RecordName: string;
    RecordType: string;
    AliasTarget?: {
      DNSName: string;
      HostedZoneId: string;
      EvaluateTargetHealth?: boolean | string;
    };
    TTL?: string | number;
    ResourceRecords?: Array<{ Value: string }>;
  };
  OldResourceProperties?: {
    HostedZoneId?: string;
    RecordName?: string;
    RecordType?: string;
  };
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
 * Lambda handler for Route53 record upsert Custom Resource
 */
export async function handler(
  event: CloudFormationCustomResourceEvent
): Promise<void> {
  console.log("Route53 Record Upsert Event:", JSON.stringify(event, null, 2));

  const props = event.ResourceProperties;
  const physicalResourceId =
    event.PhysicalResourceId ||
    `r53-${props.HostedZoneId}-${props.RecordName}-${props.RecordType}`;

  try {
    const route53 = new Route53Client({});

    if (event.RequestType === "Delete") {
      // Delete the record (best effort)
      console.log(`Deleting Route53 record: ${props.RecordName}`);
      await deleteRecord(route53, props);
      console.log(`Successfully deleted Route53 record: ${props.RecordName}`);
    } else {
      // Create or Update: both use UPSERT
      console.log(`Upserting Route53 record: ${props.RecordName}`);
      await upsertRecord(route53, props);
      console.log(`Successfully upserted Route53 record: ${props.RecordName}`);

      // On Update, if the record name changed, delete the old one
      if (event.RequestType === "Update" && event.OldResourceProperties) {
        const oldProps = event.OldResourceProperties;
        const oldRecordName = oldProps.RecordName;
        const newRecordName = props.RecordName;

        if (oldRecordName && oldRecordName !== newRecordName) {
          console.log(`Record name changed, deleting old record: ${oldRecordName}`);
          try {
            await deleteRecord(route53, {
              HostedZoneId: oldProps.HostedZoneId || props.HostedZoneId,
              RecordName: oldRecordName,
              RecordType: oldProps.RecordType || props.RecordType,
              // Use current props for alias target - we need to know what to delete
              AliasTarget: props.AliasTarget,
              TTL: props.TTL,
              ResourceRecords: props.ResourceRecords,
            } as typeof props);
          } catch (deleteError) {
            // Log but don't fail - the old record might already be gone
            console.warn(`Warning: Could not delete old record: ${deleteError}`);
          }
        }
      }
    }

    await sendResponse(event, {
      Status: "SUCCESS",
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {
        RecordName: props.RecordName,
        RecordType: props.RecordType,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);

    // For Delete, we succeed even on error to not block stack deletion
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
 * Build a ResourceRecordSet from properties
 */
function buildRecordSet(
  props: CloudFormationCustomResourceEvent["ResourceProperties"]
): ResourceRecordSet {
  // Ensure record name ends with a dot (required by Route53)
  const recordName = props.RecordName.endsWith(".")
    ? props.RecordName
    : `${props.RecordName}.`;

  const recordSet: ResourceRecordSet = {
    Name: recordName,
    Type: props.RecordType as RRType,
  };

  if (props.AliasTarget) {
    // Alias record (e.g., for CloudFront)
    const aliasTarget: AliasTarget = {
      DNSName: props.AliasTarget.DNSName,
      HostedZoneId: props.AliasTarget.HostedZoneId,
      EvaluateTargetHealth:
        props.AliasTarget.EvaluateTargetHealth === true ||
        props.AliasTarget.EvaluateTargetHealth === "true",
    };
    recordSet.AliasTarget = aliasTarget;
  } else if (props.ResourceRecords) {
    // Standard record with TTL
    recordSet.TTL = typeof props.TTL === "string" ? parseInt(props.TTL, 10) : props.TTL;
    recordSet.ResourceRecords = props.ResourceRecords;
  }

  return recordSet;
}

/**
 * Upsert a Route53 record (create or update)
 */
async function upsertRecord(
  client: Route53Client,
  props: CloudFormationCustomResourceEvent["ResourceProperties"]
): Promise<void> {
  const recordSet = buildRecordSet(props);

  const change: Change = {
    Action: "UPSERT",
    ResourceRecordSet: recordSet,
  };

  const command = new ChangeResourceRecordSetsCommand({
    HostedZoneId: props.HostedZoneId,
    ChangeBatch: {
      Comment: `CloudFormation Custom Resource UPSERT for ${props.RecordName}`,
      Changes: [change],
    },
  });

  await client.send(command);
}

/**
 * Delete a Route53 record (best effort)
 */
async function deleteRecord(
  client: Route53Client,
  props: CloudFormationCustomResourceEvent["ResourceProperties"]
): Promise<void> {
  const recordSet = buildRecordSet(props);

  const change: Change = {
    Action: "DELETE",
    ResourceRecordSet: recordSet,
  };

  try {
    const command = new ChangeResourceRecordSetsCommand({
      HostedZoneId: props.HostedZoneId,
      ChangeBatch: {
        Comment: `CloudFormation Custom Resource DELETE for ${props.RecordName}`,
        Changes: [change],
      },
    });

    await client.send(command);
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string; Code?: string };
    // InvalidChangeBatch can mean record doesn't exist - that's fine for delete
    if (
      err.name === "InvalidChangeBatch" ||
      err.Code === "InvalidChangeBatch" ||
      err.message?.includes("not found") ||
      err.message?.includes("it was not found")
    ) {
      console.log(`Record ${props.RecordName} does not exist - nothing to delete`);
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
