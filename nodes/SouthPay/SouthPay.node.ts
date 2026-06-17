import {
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type IHttpRequestMethods,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from "n8n-workflow";

const TERMINAL_STATUSES = ["completed", "overpaid", "failed", "expired", "refunded"];

export class SouthPay implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SouthPay",
    name: "southPay",
    icon: { light: "file:southpay.svg", dark: "file:southpay.svg" },
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "Create and read SouthPay crypto payments",
    defaults: { name: "SouthPay" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "southPayApi", required: true }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "create",
        options: [
          { name: "Create Payment", value: "create", action: "Create a payment" },
          { name: "Get Payment", value: "get", action: "Get a payment" },
          {
            name: "Wait For Payment",
            value: "waitForPayment",
            action: "Wait until a payment reaches a terminal status",
          },
        ],
      },
      {
        displayName: "Amount",
        name: "amount",
        type: "string",
        default: "",
        required: true,
        placeholder: "49.99",
        description: "Fiat amount to charge",
        displayOptions: { show: { operation: ["create"] } },
      },
      {
        displayName: "Currency",
        name: "currency",
        type: "string",
        default: "USD",
        required: true,
        displayOptions: { show: { operation: ["create"] } },
      },
      {
        displayName: "Order ID",
        name: "orderId",
        type: "string",
        default: "",
        description: "Your own order reference (max 255 chars)",
        displayOptions: { show: { operation: ["create"] } },
      },
      {
        displayName: "Success URL",
        name: "successUrl",
        type: "string",
        default: "",
        displayOptions: { show: { operation: ["create"] } },
      },
      {
        displayName: "Failed URL",
        name: "failedUrl",
        type: "string",
        default: "",
        displayOptions: { show: { operation: ["create"] } },
      },
      {
        displayName: "Payment ID",
        name: "paymentId",
        type: "string",
        default: "",
        required: true,
        description: "The payment id (UUID) or reference",
        displayOptions: { show: { operation: ["get", "waitForPayment"] } },
      },
      {
        displayName: "Poll Interval (Seconds)",
        name: "pollInterval",
        type: "number",
        default: 10,
        typeOptions: { minValue: 2 },
        displayOptions: { show: { operation: ["waitForPayment"] } },
      },
      {
        displayName: "Timeout (Seconds)",
        name: "timeout",
        type: "number",
        default: 600,
        typeOptions: { minValue: 0 },
        description: "Stop waiting after this many seconds (0 waits until the payment expires)",
        displayOptions: { show: { operation: ["waitForPayment"] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];
    const credentials = await this.getCredentials("southPayApi");
    const baseUrl = String(credentials.baseUrl).replace(/\/$/, "");

    const call = (method: IHttpRequestMethods, path: string, body?: IDataObject) =>
      this.helpers.httpRequestWithAuthentication.call(this, "southPayApi", {
        method,
        url: `${baseUrl}${path}`,
        body,
        json: true,
      }) as Promise<IDataObject>;

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter("operation", i) as string;
        let result: IDataObject;

        if (operation === "create") {
          const payment_intent: IDataObject = {
            amount: this.getNodeParameter("amount", i),
            currency: this.getNodeParameter("currency", i),
          };
          const orderId = this.getNodeParameter("orderId", i, "") as string;
          const successUrl = this.getNodeParameter("successUrl", i, "") as string;
          const failedUrl = this.getNodeParameter("failedUrl", i, "") as string;
          if (orderId) payment_intent.order_id = orderId;
          if (successUrl) payment_intent.success_url = successUrl;
          if (failedUrl) payment_intent.failed_url = failedUrl;
          result = await call("POST", "/payments", { payment_intent });
        } else if (operation === "get") {
          const id = this.getNodeParameter("paymentId", i) as string;
          result = await call("GET", `/payments/${encodeURIComponent(id)}`);
        } else {
          const id = this.getNodeParameter("paymentId", i) as string;
          const pollMs = (this.getNodeParameter("pollInterval", i) as number) * 1000;
          const timeoutS = this.getNodeParameter("timeout", i) as number;
          const startedAt = Date.now();
          result = await call("GET", `/payments/${encodeURIComponent(id)}`);
          while (!TERMINAL_STATUSES.includes(String(result.status))) {
            if (timeoutS > 0 && (Date.now() - startedAt) / 1000 >= timeoutS) break;
            await new Promise((resolve) => setTimeout(resolve, pollMs));
            result = await call("GET", `/payments/${encodeURIComponent(id)}`);
          }
        }

        out.push({ json: result, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
      }
    }

    return [out];
  }
}
