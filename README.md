# n8n-nodes-southpay

n8n community node for SouthPay: a **SouthPay** action node (create / get payment) and a
**SouthPay Trigger** node that fires on payment-event webhooks (with `Southpay-Signature`
verification).

## Build

```
cd integrations/n8n
npm install
npm run build      # compiles to dist/
```

## Test locally

n8n runs on your machine, so it can call a local `southpay_v2` at `http://localhost:3000`
directly (no tunnel needed).

```
# 1. build and register the package
cd integrations/n8n
npm run build
npm link

# 2. link it into n8n's custom dir
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y          # only the first time
npm link n8n-nodes-southpay

# 3. run n8n
npx n8n
```

Open `http://localhost:5678`, then:

1. Add a **SouthPay** node, create a **SouthPay API** credential. For local testing set Base
   URL to `http://localhost:3000/api/v2` and paste a secret key (`sp_sk_test_...`). The
   credential test calls `GET /payments?limit=1`.
2. Operation **Create Payment**, set Amount + Currency, execute. You should get back a payment
   with `reference`, `hosted_url`, and `payment_addresses`.
3. For the **SouthPay Trigger**: add it, copy its test webhook URL, register that URL as a
   SouthPay webhook endpoint (`POST /api/v2/webhook_endpoints`), paste the returned
   `whsec_...` into the node's Signing Secret, then complete a payment to see the event arrive.

After code changes, re-run `npm run build` and restart n8n.

## Notes

- Use a **secret key** (`sp_sk_...`); publishable keys are write-only and cannot read payments
  (the credential test would 403).
- Signature verification uses the raw request body when n8n exposes it; leave the Signing
  Secret empty to skip verification during early testing.
