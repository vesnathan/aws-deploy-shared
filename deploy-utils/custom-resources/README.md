# CloudFormation Cleanup Custom Resources

Custom Resource handlers that enable CloudFormation to properly clean up resources that have deletion constraints.

## Problem

CloudFormation cannot delete certain AWS resources due to constraints:

| Resource | Constraint | CloudFormation Error |
|----------|-----------|---------------------|
| S3 Bucket | Must be empty | `BucketNotEmpty` |
| Cognito User Pool | Domain must be deleted first | `InvalidParameterException: The user pool has a domain configured` |

## Solution

Deploy Lambda-backed Custom Resources that run cleanup operations during stack deletion:

1. **S3 Bucket Cleanup** - Empties bucket contents (including versioned objects)
2. **Cognito Domain Cleanup** - Deletes domain and identity providers

## Integration Methods

### Method 1: Nested Stack (Recommended)

Use the provided CloudFormation template as a nested stack:

```yaml
CleanupStack:
  Type: AWS::CloudFormation::Stack
  Properties:
    TemplateURL: !Sub "https://s3.${AWS::Region}.amazonaws.com/${TemplatesBucket}/cleanup-resources.yaml"
    Parameters:
      AppName: !Ref AppName
      Stage: !Ref Stage
      S3BucketNames: !Join [",", [!Ref MediaBucket, !Ref FrontendBucket]]
      UserPoolId: !Ref UserPool
      CleanupLambdaS3Bucket: !Ref TemplatesBucket
      CleanupLambdaS3Key: lambdas/cleanup-handlers.zip
```

### Method 2: Inline Resources

Add the Lambda functions and Custom Resources directly to your template.

#### Step 1: Add the Lambda Role

```yaml
CleanupLambdaRole:
  Type: AWS::IAM::Role
  Properties:
    RoleName: !Sub "${AppName}-${Stage}-cleanup-role"
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    Policies:
      - PolicyName: CleanupPolicy
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - s3:ListBucket
                - s3:ListBucketVersions
                - s3:DeleteObject
                - s3:DeleteObjectVersion
                - cognito-idp:DescribeUserPool
                - cognito-idp:DeleteUserPoolDomain
                - cognito-idp:ListIdentityProviders
                - cognito-idp:DeleteIdentityProvider
              Resource: "*"
```

#### Step 2: Add S3 Cleanup Lambda and Custom Resource

```yaml
S3CleanupFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: !Sub "${AppName}-${Stage}-s3-cleanup"
    Runtime: nodejs20.x
    Handler: s3-bucket-cleanup.handler
    Role: !GetAtt CleanupLambdaRole.Arn
    Timeout: 300
    MemorySize: 256
    Code:
      S3Bucket: !Ref TemplatesBucket
      S3Key: lambdas/cleanup-handlers.zip

# Create one Custom Resource per bucket
MediaBucketCleanup:
  Type: Custom::S3BucketCleanup
  Properties:
    ServiceToken: !GetAtt S3CleanupFunction.Arn
    BucketName: !Ref MediaBucket

# The S3 bucket depends on the cleanup resource
MediaBucket:
  Type: AWS::S3::Bucket
  DependsOn: MediaBucketCleanup  # Ensures cleanup runs before bucket deletion
  Properties:
    BucketName: !Sub "${AppName}-media-${Stage}"
```

#### Step 3: Add Cognito Cleanup Lambda and Custom Resource

```yaml
CognitoCleanupFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: !Sub "${AppName}-${Stage}-cognito-cleanup"
    Runtime: nodejs20.x
    Handler: cognito-domain-cleanup.handler
    Role: !GetAtt CleanupLambdaRole.Arn
    Timeout: 60
    Code:
      S3Bucket: !Ref TemplatesBucket
      S3Key: lambdas/cleanup-handlers.zip

UserPoolCleanup:
  Type: Custom::CognitoDomainCleanup
  Properties:
    ServiceToken: !GetAtt CognitoCleanupFunction.Arn
    UserPoolId: !Ref UserPool

UserPool:
  Type: AWS::Cognito::UserPool
  DependsOn: UserPoolCleanup  # Ensures cleanup runs before pool deletion
  Properties:
    UserPoolName: !Sub "${AppName}-${Stage}"
```

## How DependsOn Works for Deletion

CloudFormation processes `DependsOn` in **reverse order during deletion**:

1. **Create order**: MediaBucketCleanup → MediaBucket
2. **Delete order**: MediaBucket (attempted) ← MediaBucketCleanup (runs first!)

Wait... that's backwards. For cleanup to run first during deletion, the *bucket* should depend on the cleanup resource:

```yaml
MediaBucket:
  Type: AWS::S3::Bucket
  DependsOn: MediaBucketCleanup  # Wrong - this means cleanup is created first, deleted LAST
```

Actually, we need the opposite pattern. The cleanup Custom Resource should depend on nothing, and the bucket should depend on the cleanup. But that means during deletion, CloudFormation will:
1. Try to delete MediaBucket
2. Fail because bucket is not empty

**Correct Pattern**: Use a *wrapper* Custom Resource that runs on both Create and Delete:

```yaml
MediaBucketManager:
  Type: Custom::S3BucketManager
  Properties:
    ServiceToken: !GetAtt S3CleanupFunction.Arn
    BucketName: !Ref MediaBucket  # Pass the bucket name

MediaBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: !Sub "${AppName}-media-${Stage}"
```

The Custom Resource:
- On Create: No-op (bucket doesn't exist yet)
- On Delete: Empty bucket, then CloudFormation deletes the bucket

**Key**: The Custom Resource references the bucket by name or `!Ref`, creating an implicit dependency that CloudFormation handles correctly.

## Building the Lambda Package

The deploy script should compile and package these handlers:

```typescript
import { compileLambdas } from "aws-deploy-shared/deploy-utils";

// Add to your Lambda build step
await compileLambdas({
  entries: [
    {
      input: "node_modules/aws-deploy-shared/deploy-utils/custom-resources/s3-bucket-cleanup.ts",
      output: "s3-bucket-cleanup",
    },
    {
      input: "node_modules/aws-deploy-shared/deploy-utils/custom-resources/cognito-domain-cleanup.ts",
      output: "cognito-domain-cleanup",
    },
  ],
  outputDir: ".cache/lambdas/cleanup",
  zipName: "cleanup-handlers.zip",
});
```

## Testing

To test locally:

```bash
# Empty a test bucket
aws s3 rm s3://your-bucket --recursive

# Delete a Cognito domain
aws cognito-idp delete-user-pool-domain \
  --user-pool-id ap-southeast-2_XXXXX \
  --domain your-domain
```

## Troubleshooting

### Custom Resource Timeout

If the Lambda times out during deletion:
- S3 cleanup default timeout is 300s (5 minutes)
- For very large buckets, increase timeout or use lifecycle policies

### "Unable to delete resource" after timeout

If a Custom Resource Lambda times out and doesn't respond to CloudFormation:
1. The stack will be stuck in DELETE_IN_PROGRESS
2. Wait for CloudFormation's timeout (1-3 hours)
3. Or manually signal success:
   ```bash
   # Find the ResponseURL in CloudWatch Logs
   curl -X PUT -H 'Content-Type:' -d '{"Status":"SUCCESS","PhysicalResourceId":"xxx",...}' "ResponseURL"
   ```

### Permission Denied

Ensure the Lambda role has:
- `s3:ListBucket*` on the bucket
- `s3:DeleteObject*` on bucket objects (`bucket/*`)
- `cognito-idp:*` on user pools
