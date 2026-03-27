# Shared AWS Deploy Utilities

**Read shared standards:** `/home/liqk1ugzoezh5okwywlr_/dev/CLAUDE.md`

## Overview

Shared utilities and types for AWS deployment projects. Published to GitHub Packages as `@vesnathan/aws-deploy-shared`.

## Setup

After cloning, enable git hooks:

```bash
git config core.hooksPath .githooks
```

## Commands

```bash
yarn build     # Build TypeScript
yarn clean     # Remove dist folder
```

## Publishing

Package is automatically published to GitHub Packages when:
1. PR is merged to main
2. Version in package.json has changed

To publish a new version:
1. Update version in `package.json`
2. Create PR and merge to main
3. CI will automatically publish

## Exports

- `aws-deploy-shared/deploy-utils` - Deployment utilities
- `aws-deploy-shared/types` - Shared types
- `aws-deploy-shared/cognito` - Cognito utilities
- `aws-deploy-shared/subscription` - Subscription management
