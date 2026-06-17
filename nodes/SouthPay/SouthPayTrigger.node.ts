import { createHmac, timingSafeEqual } from "node:crypto";
import {
  NodeConnectionTypes,
  type IDataObject,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
} from "n8n-workflow";

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

export class SouthPayTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SouthPay Trigger",
    name: "southPayTrigger",
    icon: "fa:credit-card",
    group: ["trigger"],
    version: 1,
    description: "Starts the workflow on SouthPay payment events",
    defaults: { name: "SouthPay Trigger" },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    webhooks: [{ name: "default", httpMethod: "POST", responseMode: "onReceived", path: "southpay" }],
    properties: [
      {
        displayName: "Signing Secret",
        name: "signingSecret",
        type: "string",
        typeOptions: { password: true },
        default: "",
        description:
          "The whsec_... secret from the SouthPay webhook endpoint. Leave empty to skip verification (testing only).",
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const headers = this.getHeaderData() as Record<string, string>;
    const body = this.getBodyData() as IDataObject;
    const secret = (this.getNodeParameter("signingSecret", "") as string) || "";

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
