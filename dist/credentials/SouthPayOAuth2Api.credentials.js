"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SouthPayOAuth2Api = void 0;
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
class SouthPayOAuth2Api {
    constructor() {
        this.name = "southPayOAuth2Api";
        this.extends = ["oAuth2Api"];
        this.displayName = "SouthPay OAuth2 API";
        this.documentationUrl = "https://docs.southpay.io";
        this.properties = [
            {
                displayName: "Client ID",
                name: "clientId",
                type: "string",
                default: "spo_app_n8n",
                description: "SouthPay's first-party n8n app. Replace it only if you self-host with your own OAuth app.",
            },
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
}
exports.SouthPayOAuth2Api = SouthPayOAuth2Api;
