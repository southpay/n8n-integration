import { createHmac, timingSafeEqual } from "node:crypto";
import {
  NodeConnectionTypes,
  type IDataObject,
  type IHookFunctions,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
} from "n8n-workflow";

const ALL_PAYMENT_EVENTS = [
  "payment_intent.created",
  "payment_intent.processing",
  "payment_intent.completed",
  "payment_intent.failed",
  "payment_intent.expired",
  "payment_intent.refunded",
];

function verifySignature(secret: string, header: string, payload: string): boolean {
  const parts: Record<string, string> = {};
  for (const segment of header.split(",")) {
    const idx = segment.indexOf("=");
    if (idx > 0) parts[segment.slice(0, idx).trim()] = segment.slice(idx + 1).trim();
  }
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function apiBase(ctx: IHookFunctions): Promise<string> {
  const credentials = await ctx.getCredentials("southPayOAuth2Api");
  return String(credentials.baseUrl).replace(/\/$/, "");
}

export class SouthPayTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SouthPay Trigger",
    name: "southPayTrigger",
    icon: { light: "file:southpay.svg", dark: "file:southpay.svg" },
    group: ["trigger"],
    version: 1,
    subtitle: '={{ ($parameter["events"] || []).length ? $parameter["events"].join(", ") : "all payment events" }}',
    description: "Starts the workflow on SouthPay payment events",
    defaults: { name: "SouthPay Trigger" },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
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

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        return Boolean(this.getWorkflowStaticData("node").webhookId);
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const url = this.getNodeWebhookUrl("default");
        const events = this.getNodeParameter("events", []) as string[];
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
        })) as IDataObject;

        const data = this.getWorkflowStaticData("node");
        data.webhookId = response.id;
        data.signingSecret = response.signing_secret;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData("node");
        if (!data.webhookId) return true;

        const base = await apiBase(this);
        try {
          await this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
            method: "DELETE",
            url: `${base}/webhook_endpoints/${data.webhookId}`,
          });
        } catch {
          void 0;
        }
        delete data.webhookId;
        delete data.signingSecret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const headers = this.getHeaderData() as Record<string, string>;
    const body = this.getBodyData() as IDataObject;
    const secret = this.getWorkflowStaticData("node").signingSecret as string | undefined;

    if (secret) {
      const req = this.getRequestObject();
      const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
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
