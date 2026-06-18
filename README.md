# n8n-nodes-southpay

n8n community node for SouthPay: a **SouthPay** action node and a **SouthPay Trigger** node
that fires on payment-event webhooks (with `Southpay-Signature` verification).

Resources and operations:

- **Payment**: Create, Get, Wait For Payment, List, Refund, List Refunds
- **Customer**: Create, Get, List, Update, Delete
- **Invoice**: Create, Get, List, Finalize, Send, Void
- **Product**: Create, Get, List, Update
- **Price**: Create, Get, List
- **Subscription**: Create, Get, List, Cancel, Pause, Resume
- **Payout**: Create, Get, List, Quote
- **Balance**: Get Balances

**Wait For Payment** polls `GET /payments/{id}` every *Poll Interval* seconds until the payment
reaches a terminal status (`completed`, `overpaid`, `failed`, `expired`, `refunded`) or
*Timeout* is hit. For production, prefer the Trigger node (webhook) over polling.

### Authentication: OAuth2 (Connect account)

The node authenticates via **OAuth2 (Authorization Code + PKCE)** using the **SouthPay OAuth2 API**
credential. You connect once with "Connect my account" instead of pasting API keys, and the token
is bound to your store (no store id needed). The requested scopes cover every resource above.

One-time setup: create an OAuth app in SouthPay (`POST /api/v2/merchants/oauth_apps`) to get a
`client_id` (and `client_secret` for confidential apps), and register your n8n callback URL
(`https://<your-n8n>/rest/oauth2-credential/callback`) as a redirect URI. Paste the client id/secret
into the credential and click Connect.

Money-movement (Payout, Refund) stays gated server-side and can return `mfa_required` /
`authorization_denied` depending on store config, regardless of OAuth scope.

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

1. Add a **SouthPay** node, create a **SouthPay OAuth2 API** credential. For local testing set
   the Authorization/Access Token URLs and API Base URL to your `localhost:3000` equivalents,
   paste your `client_id`/`client_secret`, and click **Connect my account**.
2. Operation **Create Payment**, set Amount + Currency, execute. You should get back a payment
   with `reference`, `hosted_url`, and `payment_addresses`.
3. For the **SouthPay Trigger**: add it, pick the events you want, and **activate the workflow**.
   The node registers its own webhook endpoint with SouthPay (and stores the signing secret) on
   activation, and deletes it on deactivation. No manual webhook setup.

After code changes, re-run `npm run build` and restart n8n.

## Notes

- The trigger verifies the `Southpay-Signature` (`t=,v1=` HMAC-SHA256) using the signing secret
  it captured during auto-registration, via the raw request body when n8n exposes it.
- Auto-registration needs the `webhooks:write` scope (included in the credential).
