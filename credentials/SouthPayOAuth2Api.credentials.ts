import type { ICredentialType, INodeProperties } from "n8n-workflow";

const SCOPES = [
  "profile",
  "payments:read",
  "payments:write",
  "refunds:read",
  "refunds:write",
  "payouts:read",
  "payouts:write",
  "balances:read",
  "billing:read",
  "billing:write",
  "webhooks:read",
  "webhooks:write",
  "offline_access",
];

export class SouthPayOAuth2Api implements ICredentialType {
  name = "southPayOAuth2Api";
  extends = ["oAuth2Api"];
  displayName = "SouthPay OAuth2 API";
  documentationUrl = "https://docs.southpay.io";
  properties: INodeProperties[] = [
    { displayName: "Grant Type", name: "grantType", type: "hidden", default: "pkce" },
    {
      displayName: "Authorization URL",
      name: "authUrl",
      type: "string",
      default: "https://api.southpay.io/api/v2/oauth/authorize",
    },
    {
      displayName: "Access Token URL",
      name: "accessTokenUrl",
      type: "string",
      default: "https://api.southpay.io/api/v2/oauth/token",
    },
    { displayName: "Scope", name: "scope", type: "hidden", default: SCOPES.join(" ") },
    { displayName: "Auth URI Query Parameters", name: "authQueryParameters", type: "hidden", default: "" },
    { displayName: "Authentication", name: "authentication", type: "hidden", default: "header" },
    {
      displayName: "API Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.southpay.io/api/v2",
      description: "Override for local testing, e.g. http://localhost:3000/api/v2",
    },
  ];
}
