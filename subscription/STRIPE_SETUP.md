# Stripe Integration Setup Guide

Step-by-step guide to integrate Stripe subscriptions with your AWS project.

---

## Prerequisites

- AWS account with CLI configured
- Stripe account (create at https://dashboard.stripe.com/register)
- Project using the shared subscription system

---

## Step 1: Create Stripe Products & Prices

### 1.1 Log into Stripe Dashboard

**URL:** https://dashboard.stripe.com

Toggle **Test mode** (top-right) for development, or use Live mode for production.

### 1.2 Create Products

Navigate to: **Product catalog → Products → Add product**

**URL:** https://dashboard.stripe.com/products/create

For each subscription tier in your config, create a product:

| Field | Example Value |
|-------|---------------|
| Name | HelpStay Basic |
| Description | Profile listed, visible to hosts |
| Pricing model | Standard pricing |
| Price | 2.00 AUD |
| Billing period | Monthly |
| Price type | Recurring |

Click **Save product**

### 1.3 Copy Price IDs

After creating each product, click on it and find the **Price ID** in the Pricing section.

It looks like: `price_1ABC123DEF456GHI`

Record these - you'll need them for Secrets Manager:

```
BASIC tier:    price_xxxxxxxxxx
EXPLORER tier: price_yyyyyyyyyy
```

---

## Step 2: Get API Keys

### 2.1 Navigate to API Keys

**URL:** https://dashboard.stripe.com/apikeys

### 2.2 Copy Keys

| Key Type | Format | Usage |
|----------|--------|-------|
| Publishable key | `pk_test_...` or `pk_live_...` | Frontend (safe to expose) |
| Secret key | `sk_test_...` or `sk_live_...` | Backend Lambda (keep secret!) |

**Important:** Click "Reveal test/live key" to see the secret key. You can only view it once - copy it now!

---

## Step 3: Create AWS Secrets Manager Secret

### 3.1 Create Secret via AWS Console

**URL:** https://console.aws.amazon.com/secretsmanager/newsecret

Or via CLI:

```bash
# For test/development
aws secretsmanager create-secret \
  --region ap-southeast-2 \
  --name "your-project/stripe/dev" \
  --description "Stripe API keys for development" \
  --secret-string '{
    "secretKey": "sk_test_YOUR_SECRET_KEY_HERE",
    "webhookSecret": "whsec_PLACEHOLDER",
    "STRIPE_BASIC_PRICE_ID": "price_YOUR_BASIC_PRICE_ID",
    "STRIPE_EXPLORER_PRICE_ID": "price_YOUR_EXPLORER_PRICE_ID"
  }'

# For production
aws secretsmanager create-secret \
  --region ap-southeast-2 \
  --name "your-project/stripe/prod" \
  --description "Stripe API keys for production" \
  --secret-string '{
    "secretKey": "sk_live_YOUR_SECRET_KEY_HERE",
    "webhookSecret": "whsec_PLACEHOLDER",
    "STRIPE_BASIC_PRICE_ID": "price_YOUR_BASIC_PRICE_ID",
    "STRIPE_EXPLORER_PRICE_ID": "price_YOUR_EXPLORER_PRICE_ID"
  }'
```

### 3.2 Note the Secret ARN

The command returns an ARN like:
```
arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:your-project/stripe/dev-AbCdEf
```

Save this - you'll need it for CloudFormation.

---

## Step 4: Deploy Your Application

### 4.1 Add Stripe Parameter to Deployment

Pass the Secrets ARN to your CloudFormation deployment:

```bash
# Example deployment command
yarn deploy --parameters StripeSecretsArn=arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:your-project/stripe/dev-AbCdEf
```

Or add to your deployment parameters file.

### 4.2 Get Webhook URL from Outputs

After deployment, retrieve the webhook URL:

```bash
aws cloudformation describe-stacks \
  --stack-name your-project-dev \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `StripeWebhook`)].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

The URL looks like:
```
https://abc123xyz.lambda-url.ap-southeast-2.on.aws/
```

---

## Step 5: Configure Stripe Webhook

### 5.1 Add Webhook Endpoint

**URL:** https://dashboard.stripe.com/webhooks/create

Or for test mode: https://dashboard.stripe.com/test/webhooks/create

### 5.2 Configure Endpoint

| Field | Value |
|-------|-------|
| Endpoint URL | Your Lambda Function URL from Step 4.2 |
| Description | Your Project Webhook |
| Listen to | Events on your account |

### 5.3 Select Events

Click **Select events** and choose:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Click **Add endpoint**

### 5.4 Copy Signing Secret

After creating the webhook, click on it to view details.

Under **Signing secret**, click **Reveal** and copy the value.

It looks like: `whsec_ABC123...`

### 5.5 Update Secrets Manager

Update your secret with the webhook signing secret:

```bash
# Get current secret value
aws secretsmanager get-secret-value \
  --secret-id "your-project/stripe/dev" \
  --query SecretString --output text > /tmp/stripe-secret.json

# Edit the file to update webhookSecret
# Then update the secret:
aws secretsmanager update-secret \
  --secret-id "your-project/stripe/dev" \
  --secret-string file:///tmp/stripe-secret.json

# Clean up
rm /tmp/stripe-secret.json
```

Or use the AWS Console:
**URL:** https://console.aws.amazon.com/secretsmanager/secret?name=your-project/stripe/dev

---

## Step 6: Frontend Configuration

### 6.1 Add Publishable Key to Environment

```bash
# .env.local (Next.js)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY

# Or for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY
```

### 6.2 Install Stripe.js (Optional)

If using Stripe Elements for custom payment forms:

```bash
yarn add @stripe/stripe-js @stripe/react-stripe-js
```

For Checkout Sessions (redirect flow), you don't need these packages.

---

## Step 7: Test the Integration

### 7.1 Use Test Card Numbers

**URL:** https://docs.stripe.com/testing#cards

| Scenario | Card Number |
|----------|-------------|
| Successful payment | `4242 4242 4242 4242` |
| Requires authentication | `4000 0025 0000 3155` |
| Declined | `4000 0000 0000 0002` |

Use any future expiry date (e.g., `12/34`) and any 3-digit CVC.

### 7.2 Test Webhook Locally (Optional)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Or download from https://github.com/stripe/stripe-cli/releases
```

Forward webhooks to local server:
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

### 7.3 Monitor Webhook Events

**URL:** https://dashboard.stripe.com/test/webhooks

Click on your webhook endpoint to see:
- Recent events
- Delivery attempts
- Response codes

---

## Troubleshooting

### Webhook Returns 400 "Invalid signature"

- Verify `webhookSecret` in Secrets Manager matches Stripe Dashboard
- Check that raw body is being passed (not parsed JSON)
- Ensure you're using the correct webhook secret (test vs live)

### Webhook Returns 500

Check Lambda logs:
```bash
aws logs tail /aws/lambda/your-project-stripe-webhook-dev --follow
```

### Checkout Session Not Creating

- Verify Price IDs in Secrets Manager match Stripe Dashboard
- Check Lambda has permission to read from Secrets Manager
- Verify Secret ARN is correctly passed to Lambda

### Subscription Not Updating in DynamoDB

- Check GSI exists for Stripe customer lookup
- Verify DynamoDB table name in Lambda environment
- Check Lambda IAM role has DynamoDB write permissions

---

## Security Checklist

- [ ] Secret key (`sk_*`) is ONLY in Secrets Manager, never in code
- [ ] Webhook secret is stored in Secrets Manager
- [ ] Publishable key (`pk_*`) is used in frontend, not secret key
- [ ] Lambda functions have minimal required IAM permissions
- [ ] Test mode for development, live mode for production
- [ ] Webhook endpoint uses HTTPS (Lambda Function URLs do this automatically)

---

## Useful Links

| Resource | URL |
|----------|-----|
| Stripe Dashboard | https://dashboard.stripe.com |
| API Keys | https://dashboard.stripe.com/apikeys |
| Products | https://dashboard.stripe.com/products |
| Webhooks | https://dashboard.stripe.com/webhooks |
| Test Cards | https://docs.stripe.com/testing#cards |
| Stripe CLI | https://stripe.com/docs/stripe-cli |
| Checkout Docs | https://docs.stripe.com/payments/checkout |
| Billing Portal | https://docs.stripe.com/billing/subscriptions/integrating-customer-portal |
| Webhook Events | https://docs.stripe.com/api/events/types |

---

## Quick Reference: Secret Structure

```json
{
  "secretKey": "sk_test_...",
  "webhookSecret": "whsec_...",
  "STRIPE_BASIC_PRICE_ID": "price_...",
  "STRIPE_EXPLORER_PRICE_ID": "price_..."
}
```

The price ID keys must match `stripePriceIdKey` in your subscription config tiers.
