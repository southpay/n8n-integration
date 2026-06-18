"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SouthPay = void 0;
const node_crypto_1 = require("node:crypto");
const n8n_workflow_1 = require("n8n-workflow");
const descriptions_1 = require("./descriptions");
const TERMINAL_STATUSES = ["completed", "overpaid", "failed", "expired", "refunded"];
async function baseUrlFor(ctx) {
    const credentials = await ctx.getCredentials("southPayOAuth2Api");
    return String(credentials.baseUrl).replace(/\/$/, "");
}
function parseJson(value) {
    if (!value)
        return undefined;
    if (typeof value === "object")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
}
function listOf(res) {
    if (Array.isArray(res))
        return res;
    const data = res?.data;
    return Array.isArray(data) ? data : [];
}
async function search(ctx, path, label, filter) {
    const baseUrl = await baseUrlFor(ctx);
    const qs = { per_page: 25 };
    if (filter)
        qs.q = filter;
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
class SouthPay {
    constructor() {
        this.description = {
            displayName: "SouthPay",
            name: "southPay",
            icon: { light: "file:southpay.svg", dark: "file:southpay.svg" },
            group: ["transform"],
            version: 1,
            subtitle: '={{ $parameter["operation"] }}',
            description: "Work with SouthPay payments, invoices, customers, payouts and more",
            defaults: { name: "SouthPay" },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [{ name: "southPayOAuth2Api", required: true }],
            properties: descriptions_1.properties,
        };
        this.methods = {
            loadOptions: {
                async getCurrencies() {
                    const baseUrl = await baseUrlFor(this);
                    const res = (await this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
                        method: "GET",
                        url: `${baseUrl}/payment_currencies`,
                        json: true,
                    }));
                    return res.map((c) => ({ name: `${c.label} (${c.code})`, value: c.code }));
                },
                async getAssets() {
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
                async searchPayments(filter) {
                    return search(this, "/payments", (p) => `${p.reference ?? p.id} (${p.status})`, filter);
                },
                async searchCustomers(filter) {
                    return search(this, "/billing/customers", (p) => `${p.name ?? p.email ?? p.id}`, filter);
                },
                async searchInvoices(filter) {
                    return search(this, "/billing/invoices", (p) => `${p.number ?? p.formatted_number ?? p.id} (${p.status})`, filter);
                },
                async searchProducts(filter) {
                    return search(this, "/billing/products", (p) => `${p.name ?? p.id}`, filter);
                },
                async searchSubscriptions(filter) {
                    return search(this, "/billing/subscriptions", (p) => `${p.id} (${p.status})`, filter);
                },
            },
        };
    }
    async execute() {
        const items = this.getInputData();
        const out = [];
        const baseUrl = await baseUrlFor(this);
        const call = (method, path, body, headers) => this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
            method,
            url: `${baseUrl}${path}`,
            body,
            qs: undefined,
            headers,
            json: true,
        });
        const get = (path, qs) => this.helpers.httpRequestWithAuthentication.call(this, "southPayOAuth2Api", {
            method: "GET",
            url: `${baseUrl}${path}`,
            qs,
            json: true,
        });
        for (let i = 0; i < items.length; i++) {
            try {
                const resource = this.getNodeParameter("resource", i);
                const operation = this.getNodeParameter("operation", i);
                const id = (name) => this.getNodeParameter(name, i, "", { extractValue: true });
                let result;
                if (resource === "payment") {
                    if (operation === "create") {
                        const payment_intent = {
                            amount: this.getNodeParameter("amount", i),
                            currency: this.getNodeParameter("currency", i),
                        };
                        const orderId = this.getNodeParameter("orderId", i, "");
                        const successUrl = this.getNodeParameter("successUrl", i, "");
                        const failedUrl = this.getNodeParameter("failedUrl", i, "");
                        if (orderId)
                            payment_intent.order_id = orderId;
                        if (successUrl)
                            payment_intent.success_url = successUrl;
                        if (failedUrl)
                            payment_intent.failed_url = failedUrl;
                        result = await call("POST", "/payments", { payment_intent });
                    }
                    else if (operation === "get") {
                        result = await get(`/payments/${encodeURIComponent(id("paymentId"))}`);
                    }
                    else if (operation === "list") {
                        const qs = { per_page: this.getNodeParameter("perPage", i, 25) };
                        const status = this.getNodeParameter("status", i, "");
                        if (status)
                            qs.status = status;
                        result = await get("/payments", qs);
                    }
                    else if (operation === "refund") {
                        const refund = {};
                        const amount = this.getNodeParameter("refundAmount", i, "");
                        if (amount)
                            refund.amount = amount;
                        result = await call("POST", `/payments/${encodeURIComponent(id("paymentId"))}/refunds`, { refund }, { "Idempotency-Key": (0, node_crypto_1.randomUUID)() });
                    }
                    else if (operation === "listRefunds") {
                        result = await get(`/payments/${encodeURIComponent(id("paymentId"))}/refunds`);
                    }
                    else {
                        const pollMs = this.getNodeParameter("pollInterval", i) * 1000;
                        const timeoutS = this.getNodeParameter("timeout", i);
                        const startedAt = Date.now();
                        const path = `/payments/${encodeURIComponent(id("paymentId"))}`;
                        result = await get(path);
                        while (!TERMINAL_STATUSES.includes(String(result.status))) {
                            if (timeoutS > 0 && (Date.now() - startedAt) / 1000 >= timeoutS)
                                break;
                            await new Promise((resolve) => setTimeout(resolve, pollMs));
                            result = await get(path);
                        }
                    }
                }
                else if (resource === "customer") {
                    if (operation === "create" || operation === "update") {
                        const customer = {};
                        const email = this.getNodeParameter("email", i, "");
                        const name = this.getNodeParameter("name", i, "");
                        const phone = this.getNodeParameter("phone", i, "");
                        const meta = parseJson(this.getNodeParameter("metadata", i, ""));
                        if (email)
                            customer.email = email;
                        if (name)
                            customer.name = name;
                        if (phone)
                            customer.phone = phone;
                        if (meta)
                            customer.metadata = meta;
                        result =
                            operation === "create"
                                ? await call("POST", "/billing/customers", { customer })
                                : await call("PATCH", `/billing/customers/${encodeURIComponent(id("customerId"))}`, {
                                    customer,
                                });
                    }
                    else if (operation === "get") {
                        result = await get(`/billing/customers/${encodeURIComponent(id("customerId"))}`);
                    }
                    else if (operation === "delete") {
                        result = await call("DELETE", `/billing/customers/${encodeURIComponent(id("customerId"))}`);
                    }
                    else {
                        result = await get("/billing/customers", { per_page: this.getNodeParameter("perPage", i, 25) });
                    }
                }
                else if (resource === "invoice") {
                    if (operation === "create") {
                        const rawItems = this.getNodeParameter("lineItems", i, {});
                        const lineItems = (rawItems.item ?? []).map((it) => ({
                            description: it.description,
                            quantity: it.quantity,
                            unit_amount_cents: it.unit_amount_cents,
                        }));
                        const invoice = {
                            customer_id: id("customerId"),
                            currency: this.getNodeParameter("currency", i),
                            line_items: lineItems,
                        };
                        const dueAt = this.getNodeParameter("dueAt", i, "");
                        const description = this.getNodeParameter("description", i, "");
                        const meta = parseJson(this.getNodeParameter("metadata", i, ""));
                        if (dueAt)
                            invoice.due_at = dueAt;
                        if (description)
                            invoice.description = description;
                        if (meta)
                            invoice.metadata = meta;
                        result = await call("POST", "/billing/invoices", { invoice });
                    }
                    else if (operation === "get") {
                        result = await get(`/billing/invoices/${encodeURIComponent(id("invoiceId"))}`);
                    }
                    else if (operation === "list") {
                        const qs = { per_page: this.getNodeParameter("perPage", i, 25) };
                        const status = this.getNodeParameter("status", i, "");
                        if (status)
                            qs.status = status;
                        result = await get("/billing/invoices", qs);
                    }
                    else {
                        result = await call("POST", `/billing/invoices/${encodeURIComponent(id("invoiceId"))}/${operation}`);
                    }
                }
                else if (resource === "product") {
                    if (operation === "create" || operation === "update") {
                        const productBody = {};
                        const name = this.getNodeParameter("name", i, "");
                        const description = this.getNodeParameter("description", i, "");
                        const meta = parseJson(this.getNodeParameter("metadata", i, ""));
                        if (name)
                            productBody.name = name;
                        if (description)
                            productBody.description = description;
                        if (meta)
                            productBody.metadata = meta;
                        result =
                            operation === "create"
                                ? await call("POST", "/billing/products", { product: productBody })
                                : await call("PATCH", `/billing/products/${encodeURIComponent(id("productId"))}`, {
                                    product: productBody,
                                });
                    }
                    else if (operation === "get") {
                        result = await get(`/billing/products/${encodeURIComponent(id("productId"))}`);
                    }
                    else {
                        result = await get("/billing/products");
                    }
                }
                else if (resource === "price") {
                    const productId = encodeURIComponent(id("productId"));
                    if (operation === "create") {
                        const priceBody = {
                            unit_amount_cents: this.getNodeParameter("unitAmountCents", i),
                            currency: this.getNodeParameter("currency", i),
                            interval: this.getNodeParameter("interval", i),
                        };
                        result = await call("POST", `/billing/products/${productId}/prices`, { price: priceBody });
                    }
                    else if (operation === "get") {
                        const priceId = encodeURIComponent(this.getNodeParameter("priceId", i));
                        result = await get(`/billing/products/${productId}/prices/${priceId}`);
                    }
                    else {
                        result = await get(`/billing/products/${productId}/prices`);
                    }
                }
                else if (resource === "subscription") {
                    if (operation === "create") {
                        const subscription = {
                            customer_id: id("customerId"),
                            price_id: this.getNodeParameter("priceId", i),
                        };
                        const meta = parseJson(this.getNodeParameter("metadata", i, ""));
                        if (meta)
                            subscription.metadata = meta;
                        result = await call("POST", "/billing/subscriptions", { subscription });
                    }
                    else if (operation === "get") {
                        result = await get(`/billing/subscriptions/${encodeURIComponent(id("subscriptionId"))}`);
                    }
                    else if (operation === "list") {
                        result = await get("/billing/subscriptions", { per_page: this.getNodeParameter("perPage", i, 25) });
                    }
                    else {
                        result = await call("POST", `/billing/subscriptions/${encodeURIComponent(id("subscriptionId"))}/${operation}`);
                    }
                }
                else if (resource === "payout") {
                    if (operation === "create") {
                        const body = {
                            asset_id: this.getNodeParameter("assetId", i),
                            amount_atomic: this.getNodeParameter("amountAtomic", i),
                        };
                        const dest = this.getNodeParameter("destinationAddress", i, "");
                        const cryptoDetail = this.getNodeParameter("cryptoPayoutDetailId", i, "");
                        const fiatDetail = this.getNodeParameter("fiatPayoutDetailId", i, "");
                        if (dest)
                            body.destination_address = dest;
                        if (cryptoDetail)
                            body.crypto_payout_detail_id = cryptoDetail;
                        if (fiatDetail)
                            body.fiat_payout_detail_id = fiatDetail;
                        result = await call("POST", "/payouts", body, { "Idempotency-Key": (0, node_crypto_1.randomUUID)() });
                    }
                    else if (operation === "quote") {
                        const body = {
                            asset_id: this.getNodeParameter("assetId", i),
                            amount_atomic: this.getNodeParameter("amountAtomic", i),
                        };
                        const fiatDetail = this.getNodeParameter("fiatPayoutDetailId", i, "");
                        if (fiatDetail)
                            body.fiat_payout_detail_id = fiatDetail;
                        result = await call("POST", "/payouts/quote", body);
                    }
                    else if (operation === "get") {
                        result = await get(`/payouts/${encodeURIComponent(this.getNodeParameter("payoutId", i))}`);
                    }
                    else {
                        result = await get("/payouts", { per_page: this.getNodeParameter("perPage", i, 25) });
                    }
                }
                else {
                    result = await get("/balances");
                }
                out.push({ json: result, pairedItem: { item: i } });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    out.push({ json: { error: error.message }, pairedItem: { item: i } });
                    continue;
                }
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex: i });
            }
        }
        return [out];
    }
}
exports.SouthPay = SouthPay;
