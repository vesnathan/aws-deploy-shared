# Shared AWS Deployment Utilities

**⚠️ CRITICAL: These utilities are used by MULTIPLE projects. Changes affect ALL projects.**

## Projects Using These Utilities

### Currently Integrated
- ✅ **HelpStay** (`/home/liqk1ugzoezh5okwywlr_/dev/work-stay/`)

### Planned Integration
- ⏳ Quiz Night Live
- ⏳ Super Simple Apps
- ⏳ Puzzle Book
- ⏳ Footy Snaps
- ⏳ The Story Hub
- ⏳ Backroom Blackjack
- ⏳ App Builder Studio
- ⏳ Admin Dashboard
- ⏳ Rocket Lander

## Before Making Changes

**STOP AND CONSIDER:**

1. **Will this break other projects?** - Test changes against all integrated projects
2. **Is this project-specific?** - Use callbacks/hooks instead of modifying shared code
3. **Does the interface change?** - Update all projects that use the changed interface
4. **Are you adding new dependencies?** - Consider impact on all projects

## Testing Changes

When modifying shared utilities:

```bash
# Test with each project
cd /home/liqk1ugzoezh5okwywlr_/dev/work-stay && yarn deploy
cd /home/liqk1ugzoezh5okwywlr_/dev/quiz-night-live && yarn deploy
# ... etc for all integrated projects
```

## Architecture

### Core Principle: 90% Shared, 10% Project-Specific

**Shared Code (Write Once):**
- `deployment-orchestrator.ts` - Main deployment flow
- `menu-system.ts` - Interactive menus
- `logger.ts` - Logging utilities
- `resolver-compiler.ts` - AppSync resolver compilation
- `lambda-compiler.ts` - Lambda function compilation
- `schema-manager.ts` - GraphQL schema merging
- `template-uploader.ts` - CloudFormation template uploads
- `frontend-deployment.ts` - Frontend build & S3 deploy
- `stack-manager.ts` - CloudFormation operations
- `removal-orchestrator.ts` - Stack deletion
- `user-safety.ts` - Cognito user checks
- `s3-cleanup.ts` - S3 bucket emptying
- `stack-deletion.ts` - Stack deletion with retry
- `orphan-cleanup.ts` - Orphaned resource cleanup

**Project-Specific (Each project's `deploy/deploy.ts`):**
- App name
- Stage names (dev, prod, staging, etc.)
- Stack parameters
- Frontend env vars
- Custom hooks (pre/post deploy)
- Region overrides

## Making Project-Specific Changes

**✅ CORRECT: Use callbacks/config**

```typescript
// In project's deploy.ts
const orchestrator = new DeploymentOrchestrator({
  appName: "myapp",
  stages: [...],

  // Project-specific logic via callbacks
  getStackParameters: (stage, buildHashes) => {
    // Custom logic here
    return [...];
  },

  // Custom hooks for special needs
  seedDatabase: async (outputs, stage) => {
    // Project-specific seeding
  },
});
```

**❌ WRONG: Modify shared code**

```typescript
// DON'T do this in deployment-orchestrator.ts
if (appName === "myapp") {
  // Special handling for myapp
}
```

## File Descriptions

### Deployment Flow
- **deployment-orchestrator.ts** - Main orchestration, handles menu → execution
- **menu-system.ts** - Stage selection and deployment option menus
- **bootstrap-checker.ts** - Validates AWS credentials and bootstrap resources

### Build & Upload
- **resolver-compiler.ts** - Compiles AppSync resolvers with esbuild → S3
- **lambda-compiler.ts** - Compiles Lambda functions with esbuild → S3
- **schema-manager.ts** - Merges .graphql files → S3
- **template-uploader.ts** - Uploads CloudFormation templates → S3

### CloudFormation
- **stack-manager.ts** - Create/update/describe stacks
- **stack-deletion.ts** - Delete stacks with retry logic

### Frontend
- **frontend-deployment.ts** - Next.js build → S3 → CloudFront invalidation

### Removal
- **removal-orchestrator.ts** - 12-step removal process
- **user-safety.ts** - Check Cognito for active users (block deletion)
- **s3-cleanup.ts** - Empty S3 buckets before deletion
- **orphan-cleanup.ts** - Clean up resources after stack deletion
- **confirmation-prompts.ts** - ASCII warnings and confirmations

### Utilities
- **logger.ts** - Structured logging (info/warning/error/success)
- **s3-utils.ts** - S3 helper functions
- **types.ts** - TypeScript interfaces

### CloudFormation Custom Resources (`custom-resources/`)
- **s3-bucket-cleanup.ts** - Lambda handler to empty S3 buckets during stack deletion
- **cognito-domain-cleanup.ts** - Lambda handler to delete Cognito domains during stack deletion
- **README.md** - Full integration guide for custom resources

### CloudFormation Templates (`cloudformation/`)
- **cleanup-resources.yaml** - Nested stack template for cleanup custom resources

## Common Patterns

### Adding a New Deployment Option

1. Add to `menu-system.ts` `DeployOption` type
2. Add to `DEFAULT_MENU_OPTIONS` array
3. Add case in `deployment-orchestrator.ts` `executeDeployment()`

### Adding a New Stack Parameter

Add to project's `deploy.ts`:

```typescript
getStackParameters: (stage, buildHashes) => [
  // ... existing params
  { ParameterKey: "NewParam", ParameterValue: value },
],
```

### Adding a Pre-Deploy Hook

Add to project's `deploy.ts`:

```typescript
// In seedDatabase function or new custom function
async function customPreDeploy(outputs, stage) {
  // Custom logic
}

// Pass to orchestrator
seedDatabase: customPreDeploy,
```

## Deployment Checklist

When integrating a new project:

- [ ] Add project to "Currently Integrated" list above
- [ ] Test full deployment flow
- [ ] Test frontend-only deployment
- [ ] Test removal (on dev environment only!)
- [ ] Verify all CloudFormation parameters are passed correctly
- [ ] Check that frontend env vars are correct
- [ ] Confirm Cognito domain override (if using custom domain)

## Migration Guide

Converting a project to use shared utilities:

1. **Install shared package**
   ```json
   // In deploy/package.json
   "dependencies": {
     "aws-deploy-shared": "*"
   }
   ```

2. **Add to root workspace**
   ```json
   // In root package.json
   "workspaces": [..., "../shared"]
   ```

3. **Replace deploy.ts** (see HelpStay's `deploy/deploy.ts` as reference)

4. **Test thoroughly** before removing old code

## Handling CloudFormation Deletion Failures

CloudFormation cannot delete certain resources due to constraints:

| Resource | Constraint | Solution |
|----------|-----------|----------|
| S3 Bucket | Must be empty | Use `S3BucketCleanup` Custom Resource |
| Cognito User Pool | Domain must be deleted first | Use `CognitoDomainCleanup` Custom Resource |

### Adding Cleanup Custom Resources to Your Stack

**Option 1: Use the nested stack template**

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

**Option 2: Add inline Lambda functions**

See `custom-resources/README.md` for full integration guide.

### Building Cleanup Lambda Handlers

In your deploy script, compile the cleanup handlers:

```typescript
import { LambdaCompiler } from "aws-deploy-shared/deploy-utils";

const compiler = new LambdaCompiler({...});

// Add cleanup handlers to your Lambda build
await compiler.compileLambdas([
  // ... your project's Lambda functions
  {
    entry: require.resolve("aws-deploy-shared/deploy-utils/custom-resources/s3-bucket-cleanup"),
    name: "s3-bucket-cleanup",
  },
  {
    entry: require.resolve("aws-deploy-shared/deploy-utils/custom-resources/cognito-domain-cleanup"),
    name: "cognito-domain-cleanup",
  },
]);
```

## Support

Questions or issues? Check:
1. HelpStay's `deploy/deploy.ts` as reference implementation
2. This README
3. Inline comments in shared utility files
