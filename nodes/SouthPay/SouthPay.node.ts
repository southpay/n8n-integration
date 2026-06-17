import {
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type IHttpRequestMethods,
  type ILoadOptionsFunctions,
  type INodeExecutionData,
  type INodeListSearchResult,
  type INodePropertyOptions,
  type INodeType,
  type INodeTypeDescription,
} from "n8n-workflow";

const TERMINAL_STATUSES = ["completed", "overpaid", "failed", "expired", "refunded"];

async function baseUrlFor(ctx: IExecuteFunctions | ILoadOptionsFunctions): Promise<string> {
  const credentials = await ctx.getCredentials("southPayApi");
  return String(credentials.baseUrl).replace(/\/$/, "");
}

export class SouthPay implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SouthPay",
    name: "southPay",
    icon: { light: "file:southpay.svg", dark: "file:southpay.svg" },
    group: ["transform"],
    version: 1,
    subtitle:
      '={{ $parameter["operation"] === "create" ? ($parameter["amount"] + " " + $parameter["currency"]) : ($parameter["operation"] === "waitForPayment" ? ("waiting every " + $parameter["pollInterval"] + "s") : "get payment") }}',
    description: "Create and read SouthPay crypto payments",
    defaults: { name: "SouthPay" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "southPayApi", required: true }],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        default: "payment",
        options: [{ name: "Payment", value: "payment" }],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "create",
        displayOptions: { show: { resource: ["payment"] } },
        options: [
          {
            name: "Create a Payment",
            value: "create",
            action: "Create a payment",
            description: "Create a payment and get a deposit address",
          },
          {
            name: "Get a Payment",
            value: "get",
            action: "Get a payment",
            description: "Retrieve a payment by id or reference",
          },
          {
            name: "Wait for a Payment",
            value: "waitForPayment",
            action: "Wait for a payment",
            description: "Poll until the payment reaches a terminal status",
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
        displayOptions: { show: { resource: ["payment"], operation: ["create"] } },
      },
      {
        displayName: "Currency",
        name: "currency",
        type: "options",
        typeOptions: { loadOptionsMethod: "getCurrencies" },
        default: "USD",
        required: true,
        displayOptions: { show: { resource: ["payment"], operation: ["create"] } },
      },
      {
        displayName: "Order ID",
        name: "orderId",
        type: "string",
        default: "",
        description: "Your own order reference (max 255 chars)",
        displayOptions: { show: { resource: ["payment"], operation: ["create"] } },
      },
      {
        displayName: "Success URL",
        name: "successUrl",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["payment"], operation: ["create"] } },
      },
      {
        displayName: "Failed URL",
        name: "failedUrl",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["payment"], operation: ["create"] } },
      },
      {
        displayName: "Payment",
        name: "paymentId",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        required: true,
        description: "The payment to look up",
        displayOptions: { show: { resource: ["payment"], operation: ["get", "waitForPayment"] } },
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            placeholder: "Select a payment...",
            typeOptions: { searchListMethod: "searchPayments", searchable: true },
          },
          {
            displayName: "By ID",
            name: "id",
            type: "string",
            placeholder: "pi_... or SPAYREF...",
          },
        ],
      },
      {
        displayName: "Poll Interval (Seconds)",
        name: "pollInterval",
        type: "number",
        default: 10,
        typeOptions: { minValue: 2 },
        displayOptions: { show: { resource: ["payment"], operation: ["waitForPayment"] } },
      },
      {
        displayName: "Timeout (Seconds)",
        name: "timeout",
        type: "number",
        default: 600,
        typeOptions: { minValue: 0 },
        description: "Stop waiting after this many seconds (0 waits until the payment expires)",
        displayOptions: { show: { resource: ["payment"], operation: ["waitForPayment"] } },
      },
    ],
  };

  methods = {
    loadOptions: {
      async getCurrencies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const baseUrl = await baseUrlFor(this);
        const res = (await this.helpers.httpRequestWithAuthentication.call(this, "southPayApi", {
          method: "GET",
          url: `${baseUrl}/payment_currencies`,
          json: true,
        })) as Array<{ code: string; label: string }>;
        return res.map((c) => ({ name: `${c.label} (${c.code})`, value: c.code }));
      },
    },
    listSearch: {
      async searchPayments(
        this: ILoadOptionsFunctions,
        filter?: string,
      ): Promise<INodeListSearchResult> {
        const baseUrl = await baseUrlFor(this);
        const qs: IDataObject = { per_page: 25 };
        if (filter) qs.q = filter;
        const res = (await this.helpers.httpRequestWithAuthentication.call(this, "southPayApi", {
          method: "GET",
          url: `${baseUrl}/payments`,
          qs,
          json: true,
        })) as IDataObject;
        const data = (res.data as IDataObject[] | undefined) ?? [];
        return {
          results: data.map((p) => ({
            name: `${p.reference ?? p.id} (${p.status})`,
            value: String(p.id ?? p.reference),
          })),
        };
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];
    const baseUrl = await baseUrlFor(this);

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
          const id = this.getNodeParameter("paymentId", i, undefined, { extractValue: true }) as string;
          result = await call("GET", `/payments/${encodeURIComponent(id)}`);
        } else {
          const id = this.getNodeParameter("paymentId", i, undefined, { extractValue: true }) as string;
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
