"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SouthPayTrigger = void 0;
const node_crypto_1 = require("node:crypto");
const n8n_workflow_1 = require("n8n-workflow");
const ALL_PAYMENT_EVENTS = [
    "payment_intent.created",
    "payment_intent.processing",
    "payment_intent.completed",
    "payment_intent.failed",
    "payment_intent.expired",
    "payment_intent.refunded",
];
function verifySignature(secret, header, payload) {
    const parts = {};
    for (const segment of header.split(",")) {
        const idx = segment.indexOf("=");
        if (idx > 0)
            parts[segment.slice(0, idx).trim()] = segment.slice(idx + 1).trim();
    }
    if (!parts.t || !parts.v1)
        return false;
    const expected = (0, node_crypto_1.createHmac)("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(parts.v1);
    return a.length === b.length && (0, node_crypto_1.timingSafeEqual)(a, b);
}
async function apiBase(ctx) {
    const credentials = await ctx.getCredentials("southPayOAuth2Api");
    return String(credentials.baseUrl).replace(/\/$/, "");
}
class SouthPayTrigger {
    constructor() {
        this.description = {
            displayName: "SouthPay Trigger",
            name: "southPayTrigger",
            icon: { light: "file:southpay.svg", dark: "file:southpay.svg" },
            group: ["trigger"],
            version: 1,
            subtitle: '={{ ($parameter["events"] || []).length ? $parameter["events"].join(", ") : "all payment events" }}',
            description: "Starts the workflow on SouthPay payment events",
            defaults: { name: "SouthPay Trigger" },
            inputs: [],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [{ name: "southPayOAuth2Api", required: true }],
            webhooks: [{ name: "default", httpMethod: "POST", responseMode: "onReceived", path: "southpay" }],
            properties: [
                {
                    displayName: "Events",
                    name: "events",
                    type: "multiOptions",
                    default: [],
                    description: "Which events to subscribe to. Leave empty for all payment events.",
                    options: [
                        { name: "Payment Created", value: "payment_intent.created" },
                        { name: "Payment Processing", value: "payment_intent.processing" },
                        { name: "Payment Completed", value: "payment_intent.completed" },
                        { name: "Payment Failed", value: "payment_intent.failed" },
                        { name: "Payment Expired", value: "payment_intent.expired" },
                        { name: "Payment Refunded", value: "payment_intent.refunded" },
                    ],
                },
            ],
        };
        this.webhookMethods = {
            default: {
                async checkExists() {
                    return Boolean(this.getWorkflowStaticData("node").webhookId);
                },
                async create() {
                    const url = this.getNodeWebhookUrl("default");
                    const events = this.getNodeParameter("events", []);
                    const base = await apiBase(this);
                    const response = (await this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
                        method: "POST",
                        url: `${base}/webhook_endpoints`,
                        body: {
                            webhook_endpoint: {
                                url,
                                platform: "n8n",
                                subscribed_events: events.length ? events : ALL_PAYMENT_EVENTS,
                            },
                        },
                        json: true,
                    }));
                    const data = this.getWorkflowStaticData("node");
                    data.webhookId = response.id;
                    data.signingSecret = response.signing_secret;
                    return true;
                },
                async delete() {
                    const data = this.getWorkflowStaticData("node");
                    if (!data.webhookId)
                        return true;
                    const base = await apiBase(this);
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
                            method: "DELETE",
                            url: `${base}/webhook_endpoints/${data.webhookId}`,
                        });
                    }
                    catch {
                        void 0;
                    }
                    delete data.webhookId;
                    delete data.signingSecret;
                    return true;
                },
            },
        };
    }
    async webhook() {
        const headers = this.getHeaderData();
        const body = this.getBodyData();
        const secret = this.getWorkflowStaticData("node").signingSecret;
        if (secret) {
            const req = this.getRequestObject();
            const raw = req.rawBody;
            const payload = raw ? raw.toString("utf8") : JSON.stringify(body);
            if (!verifySignature(secret, headers["southpay-signature"] || "", payload)) {
                const res = this.getResponseObject();
                res.status(401).send("invalid signature");
                return { noWebhookResponse: true };
            }
        }
        return { workflowData: [this.helpers.returnJsonArray([body])] };
    }
}
exports.SouthPayTrigger = SouthPayTrigger;
