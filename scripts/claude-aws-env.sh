#!/bin/bash
# Source this script to set Claude IAM credentials for AWS CLI
# Usage: source scripts/claude-aws-env.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  return 1
fi

# Read credentials from .env
export AWS_ACCESS_KEY_ID=$(grep '^CLAUDE_IAM_USER_KEY=' "$ENV_FILE" | cut -d '=' -f2)
export AWS_SECRET_ACCESS_KEY=$(grep '^CLAUDE_IAM_USER_SECRET=' "$ENV_FILE" | cut -d '=' -f2)
export AWS_REGION=$(grep '^AWS_REGION=' "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "Error: CLAUDE_IAM_USER_KEY or CLAUDE_IAM_USER_SECRET not found in .env"
  return 1
fi

echo "AWS credentials set for Claude IAM user (region: ${AWS_REGION:-not set})"
