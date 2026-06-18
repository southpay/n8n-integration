import { randomUUID } from "node:crypto";
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
import { properties } from "./descriptions";

const TERMINAL_STATUSES = ["completed", "overpaid", "failed", "expired", "refunded"];

async function baseUrlFor(ctx: IExecuteFunctions | ILoadOptionsFunctions): Promise<string> {
  const credentials = await ctx.getCredentials("southPayOAuth2Api");
  return String(credentials.baseUrl).replace(/\/$/, "");
}

function parseJson(value: unknown): IDataObject | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as IDataObject;
  try {
    return JSON.parse(value as string) as IDataObject;
  } catch {
    return undefined;
  }
}

function listOf(res: unknown): IDataObject[] {
  if (Array.isArray(res)) return res as IDataObject[];
  const data = (res as IDataObject)?.data;
  return Array.isArray(data) ? (data as IDataObject[]) : [];
}

async function search(
  ctx: ILoadOptionsFunctions,
  path: string,
  label: (p: IDataObject) => string,
  filter?: string,
): Promise<INodeListSearchResult> {
  const baseUrl = await baseUrlFor(ctx);
  const qs: IDataObject = { per_page: 25 };
  if (filter) qs.q = filter;
  const res = await ctx.helpers.httpRequestWithAuthentication.call(ctx, "southPayOAuth2Api", {
    method: "GET",
    url: `${baseUrl}${path}`,
    qs,
    json: true,
  });
  return {
    results: listOf(res).map((p) => ({ name: label(p), value: String(p.id ?? p.reference) })),
  };
}

export class SouthPay implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SouthPay",
    name: "southPay",
    icon: { light: "file:southpay.svg", dark: "file:southpay.svg" },
    group: ["transform"],
    version: 1,
    subtitle: '={{ $parameter["operation"] }}',
    description: "Work with SouthPay payments, invoices, customers, payouts and more",
    defaults: { name: "SouthPay" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "southPayOAuth2Api", required: true }],
    properties,
  };

  methods = {
    loadOptions: {
      async getCurrencies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const baseUrl = await baseUrlFor(this);
        const res = (await this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
          method: "GET",
          url: `${baseUrl}/payment_currencies`,
          json: true,
        })) as Array<{ code: string; label: string }>;
        return res.map((c) => ({ name: `${c.label} (${c.code})`, value: c.code }));
      },
      async getAssets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const baseUrl = await baseUrlFor(this);
        const res = await this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
          method: "GET",
          url: `${baseUrl}/supported_assets`,
          json: true,
        });
        return listOf(res).map((a) => ({
          name: `${a.coin_symbol} (${a.chain_symbol})`,
          value: String(a.asset_id),
        }));
      },
    },
    listSearch: {
      async searchPayments(this: ILoadOptionsFunctions, filter?: string) {
        return search(this, "/payments", (p) => `${p.reference ?? p.id} (${p.status})`, filter);
      },
      async searchCustomers(this: ILoadOptionsFunctions, filter?: string) {
        return search(this, "/billing/customers", (p) => `${p.name ?? p.email ?? p.id}`, filter);
      },
      async searchInvoices(this: ILoadOptionsFunctions, filter?: string) {
        return search(
          this,
          "/billing/invoices",
          (p) => `${p.number ?? p.formatted_number ?? p.id} (${p.status})`,
          filter,
        );
      },
      async searchProducts(this: ILoadOptionsFunctions, filter?: string) {
        return search(this, "/billing/products", (p) => `${p.name ?? p.id}`, filter);
      },
      async searchSubscriptions(this: ILoadOptionsFunctions, filter?: string) {
        return search(this, "/billing/subscriptions", (p) => `${p.id} (${p.status})`, filter);
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];
    const baseUrl = await baseUrlFor(this);

    const call = (
      method: IHttpRequestMethods,
      path: string,
      body?: IDataObject,
      headers?: IDataObject,
    ) =>
      this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
        method,
        url: `${baseUrl}${path}`,
        body,
        qs: undefined,
        headers,
        json: true,
      }) as Promise<IDataObject>;

    const get = (path: string, qs?: IDataObject) =>
      this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
        method: "GET",
        url: `${baseUrl}${path}`,
        qs,
        json: true,
      }) as Promise<IDataObject>;

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter("resource", i) as string;
        const operation = this.getNodeParameter("operation", i) as string;
        const id = (name: string) =>
          this.getNodeParameter(name, i, "", { extractValue: true }) as string;
        let result: IDataObject;

        if (resource === "payment") {
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
            result = await get(`/payments/${encodeURIComponent(id("paymentId"))}`);
          } else if (operation === "list") {
            const qs: IDataObject = { per_page: this.getNodeParameter("perPage", i, 25) };
            const status = this.getNodeParameter("status", i, "") as string;
            if (status) qs.status = status;
            result = await get("/payments", qs);
          } else if (operation === "refund") {
            const refund: IDataObject = {};
            const amount = this.getNodeParameter("refundAmount", i, "") as string;
            if (amount) refund.amount = amount;
            result = await call(
              "POST",
              `/payments/${encodeURIComponent(id("paymentId"))}/refunds`,
              { refund },
              { "Idempotency-Key": randomUUID() },
            );
          } else if (operation === "listRefunds") {
            result = await get(`/payments/${encodeURIComponent(id("paymentId"))}/refunds`);
          } else {
            const pollMs = (this.getNodeParameter("pollInterval", i) as number) * 1000;
            const timeoutS = this.getNodeParameter("timeout", i) as number;
            const startedAt = Date.now();
            const path = `/payments/${encodeURIComponent(id("paymentId"))}`;
            result = await get(path);
            while (!TERMINAL_STATUSES.includes(String(result.status))) {
              if (timeoutS > 0 && (Date.now() - startedAt) / 1000 >= timeoutS) break;
              await new Promise((resolve) => setTimeout(resolve, pollMs));
              result = await get(path);
            }
          }
        } else if (resource === "customer") {
          if (operation === "create" || operation === "update") {
            const customer: IDataObject = {};
            const email = this.getNodeParameter("email", i, "") as string;
            const name = this.getNodeParameter("name", i, "") as string;
            const phone = this.getNodeParameter("phone", i, "") as string;
            const meta = parseJson(this.getNodeParameter("metadata", i, ""));
            if (email) customer.email = email;
            if (name) customer.name = name;
            if (phone) customer.phone = phone;
            if (meta) customer.metadata = meta;
            result =
              operation === "create"
                ? await call("POST", "/billing/customers", { customer })
                : await call("PATCH", `/billing/customers/${encodeURIComponent(id("customerId"))}`, {
                    customer,
                  });
          } else if (operation === "get") {
            result = await get(`/billing/customers/${encodeURIComponent(id("customerId"))}`);
          } else if (operation === "delete") {
            result = await call("DELETE", `/billing/customers/${encodeURIComponent(id("customerId"))}`);
          } else {
            result = await get("/billing/customers", { per_page: this.getNodeParameter("perPage", i, 25) });
          }
        } else if (resource === "invoice") {
          if (operation === "create") {
            const rawItems = this.getNodeParameter("lineItems", i, {}) as IDataObject;
            const lineItems = ((rawItems.item as IDataObject[]) ?? []).map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unit_amount_cents: it.unit_amount_cents,
            }));
            const invoice: IDataObject = {
              customer_id: id("customerId"),
              currency: this.getNodeParameter("currency", i),
              line_items: lineItems,
            };
            const dueAt = this.getNodeParameter("dueAt", i, "") as string;
            const description = this.getNodeParameter("description", i, "") as string;
            const meta = parseJson(this.getNodeParameter("metadata", i, ""));
            if (dueAt) invoice.due_at = dueAt;
            if (description) invoice.description = description;
            if (meta) invoice.metadata = meta;
            result = await call("POST", "/billing/invoices", { invoice });
          } else if (operation === "get") {
            result = await get(`/billing/invoices/${encodeURIComponent(id("invoiceId"))}`);
          } else if (operation === "list") {
            const qs: IDataObject = { per_page: this.getNodeParameter("perPage", i, 25) };
            const status = this.getNodeParameter("status", i, "") as string;
            if (status) qs.status = status;
            result = await get("/billing/invoices", qs);
          } else {
            result = await call("POST", `/billing/invoices/${encodeURIComponent(id("invoiceId"))}/${operation}`);
          }
        } else if (resource === "product") {
          if (operation === "create" || operation === "update") {
            const productBody: IDataObject = {};
            const name = this.getNodeParameter("name", i, "") as string;
            const description = this.getNodeParameter("description", i, "") as string;
            const meta = parseJson(this.getNodeParameter("metadata", i, ""));
            if (name) productBody.name = name;
            if (description) productBody.description = description;
            if (meta) productBody.metadata = meta;
            result =
              operation === "create"
                ? await call("POST", "/billing/products", { product: productBody })
                : await call("PATCH", `/billing/products/${encodeURIComponent(id("productId"))}`, {
                    product: productBody,
                  });
          } else if (operation === "get") {
            result = await get(`/billing/products/${encodeURIComponent(id("productId"))}`);
          } else {
            result = await get("/billing/products");
          }
        } else if (resource === "price") {
          const productId = encodeURIComponent(id("productId"));
          if (operation === "create") {
            const priceBody: IDataObject = {
              unit_amount_cents: this.getNodeParameter("unitAmountCents", i),
              currency: this.getNodeParameter("currency", i),
              interval: this.getNodeParameter("interval", i),
            };
            result = await call("POST", `/billing/products/${productId}/prices`, { price: priceBody });
          } else if (operation === "get") {
            const priceId = encodeURIComponent(this.getNodeParameter("priceId", i) as string);
            result = await get(`/billing/products/${productId}/prices/${priceId}`);
          } else {
            result = await get(`/billing/products/${productId}/prices`);
          }
        } else if (resource === "subscription") {
          if (operation === "create") {
            const subscription: IDataObject = {
              customer_id: id("customerId"),
              price_id: this.getNodeParameter("priceId", i),
            };
            const meta = parseJson(this.getNodeParameter("metadata", i, ""));
            if (meta) subscription.metadata = meta;
            result = await call("POST", "/billing/subscriptions", { subscription });
          } else if (operation === "get") {
            result = await get(`/billing/subscriptions/${encodeURIComponent(id("subscriptionId"))}`);
          } else if (operation === "list") {
            result = await get("/billing/subscriptions", { per_page: this.getNodeParameter("perPage", i, 25) });
          } else {
            result = await call(
              "POST",
              `/billing/subscriptions/${encodeURIComponent(id("subscriptionId"))}/${operation}`,
            );
          }
        } else if (resource === "payout") {
          if (operation === "create") {
            const body: IDataObject = {
              asset_id: this.getNodeParameter("assetId", i),
              amount_atomic: this.getNodeParameter("amountAtomic", i),
            };
            const dest = this.getNodeParameter("destinationAddress", i, "") as string;
            const cryptoDetail = this.getNodeParameter("cryptoPayoutDetailId", i, "") as string;
            const fiatDetail = this.getNodeParameter("fiatPayoutDetailId", i, "") as string;
            if (dest) body.destination_address = dest;
            if (cryptoDetail) body.crypto_payout_detail_id = cryptoDetail;
            if (fiatDetail) body.fiat_payout_detail_id = fiatDetail;
            result = await call("POST", "/payouts", body, { "Idempotency-Key": randomUUID() });
          } else if (operation === "quote") {
            const body: IDataObject = {
              asset_id: this.getNodeParameter("assetId", i),
              amount_atomic: this.getNodeParameter("amountAtomic", i),
            };
            const fiatDetail = this.getNodeParameter("fiatPayoutDetailId", i, "") as string;
            if (fiatDetail) body.fiat_payout_detail_id = fiatDetail;
            result = await call("POST", "/payouts/quote", body);
          } else if (operation === "get") {
            result = await get(`/payouts/${encodeURIComponent(this.getNodeParameter("payoutId", i) as string)}`);
          } else {
            result = await get("/payouts", { per_page: this.getNodeParameter("perPage", i, 25) });
          }
        } else {
          result = await get("/balances");
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
