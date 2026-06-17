import type { INodeProperties } from "n8n-workflow";

type Show = { resource: string[]; operation?: string[] };

function picker(
  name: string,
  displayName: string,
  searchMethod: string,
  show: Show,
  opts: { description?: string; placeholder?: string; idPlaceholder?: string } = {},
): INodeProperties {
  return {
    displayName,
    name,
    type: "resourceLocator",
    default: { mode: "list", value: "" },
    required: true,
    description: opts.description,
    displayOptions: { show },
    modes: [
      {
        displayName: "From List",
        name: "list",
        type: "list",
        placeholder: opts.placeholder ?? "Select...",
        typeOptions: { searchListMethod: searchMethod, searchable: true },
      },
      { displayName: "By ID", name: "id", type: "string", placeholder: opts.idPlaceholder ?? "id" },
    ],
  };
}

function currency(show: Show): INodeProperties {
  return {
    displayName: "Currency",
    name: "currency",
    type: "options",
    typeOptions: { loadOptionsMethod: "getCurrencies" },
    default: "USD",
    required: true,
    displayOptions: { show },
  };
}

function metadata(show: Show): INodeProperties {
  return {
    displayName: "Metadata",
    name: "metadata",
    type: "json",
    default: "{}",
    description: "A JSON object of string values",
    displayOptions: { show },
  };
}

const resource: INodeProperties = {
  displayName: "Resource",
  name: "resource",
  type: "options",
  noDataExpression: true,
  default: "payment",
  options: [
    { name: "Payment", value: "payment" },
    { name: "Customer", value: "customer" },
    { name: "Invoice", value: "invoice" },
    { name: "Product", value: "product" },
    { name: "Price", value: "price" },
    { name: "Subscription", value: "subscription" },
    { name: "Payout", value: "payout" },
    { name: "Balance", value: "balance" },
  ],
};

const payment: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "create",
    displayOptions: { show: { resource: ["payment"] } },
    options: [
      { name: "Create a Payment", value: "create", action: "Create a payment" },
      { name: "Get a Payment", value: "get", action: "Get a payment" },
      { name: "Wait for a Payment", value: "waitForPayment", action: "Wait for a payment" },
      { name: "List Payments", value: "list", action: "List payments" },
      { name: "Refund a Payment", value: "refund", action: "Refund a payment" },
      { name: "List Refunds", value: "listRefunds", action: "List refunds" },
    ],
  },
  {
    displayName: "Amount",
    name: "amount",
    type: "string",
    default: "",
    required: true,
    placeholder: "49.99",
    displayOptions: { show: { resource: ["payment"], operation: ["create"] } },
  },
  currency({ resource: ["payment"], operation: ["create"] }),
  {
    displayName: "Order ID",
    name: "orderId",
    type: "string",
    default: "",
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
  picker("paymentId", "Payment", "searchPayments", {
    resource: ["payment"],
    operation: ["get", "waitForPayment", "refund", "listRefunds"],
  }),
  {
    displayName: "Refund Amount",
    name: "refundAmount",
    type: "string",
    default: "",
    description: "Crypto amount to refund (decimal). Leave empty to refund the full amount.",
    displayOptions: { show: { resource: ["payment"], operation: ["refund"] } },
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
    displayOptions: { show: { resource: ["payment"], operation: ["waitForPayment"] } },
  },
  {
    displayName: "Status",
    name: "status",
    type: "string",
    default: "",
    description: "Filter by status",
    displayOptions: { show: { resource: ["payment"], operation: ["list"] } },
  },
  {
    displayName: "Limit",
    name: "perPage",
    type: "number",
    default: 25,
    typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ["payment"], operation: ["list"] } },
  },
];

const customer: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "create",
    displayOptions: { show: { resource: ["customer"] } },
    options: [
      { name: "Create a Customer", value: "create", action: "Create a customer" },
      { name: "Get a Customer", value: "get", action: "Get a customer" },
      { name: "List Customers", value: "list", action: "List customers" },
      { name: "Update a Customer", value: "update", action: "Update a customer" },
      { name: "Delete a Customer", value: "delete", action: "Delete a customer" },
    ],
  },
  {
    displayName: "Email",
    name: "email",
    type: "string",
    default: "",
    required: true,
    displayOptions: { show: { resource: ["customer"], operation: ["create"] } },
  },
  {
    displayName: "Name",
    name: "name",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["customer"], operation: ["create", "update"] } },
  },
  {
    displayName: "Email",
    name: "email",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["customer"], operation: ["update"] } },
  },
  {
    displayName: "Phone",
    name: "phone",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["customer"], operation: ["create", "update"] } },
  },
  metadata({ resource: ["customer"], operation: ["create", "update"] }),
  picker("customerId", "Customer", "searchCustomers", {
    resource: ["customer"],
    operation: ["get", "update", "delete"],
  }),
  {
    displayName: "Limit",
    name: "perPage",
    type: "number",
    default: 25,
    typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ["customer"], operation: ["list"] } },
  },
];

const invoice: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "create",
    displayOptions: { show: { resource: ["invoice"] } },
    options: [
      { name: "Create an Invoice", value: "create", action: "Create an invoice" },
      { name: "Get an Invoice", value: "get", action: "Get an invoice" },
      { name: "List Invoices", value: "list", action: "List invoices" },
      { name: "Finalize an Invoice", value: "finalize", action: "Finalize an invoice" },
      { name: "Send an Invoice", value: "send", action: "Send an invoice" },
      { name: "Void an Invoice", value: "void", action: "Void an invoice" },
    ],
  },
  picker("customerId", "Customer", "searchCustomers", {
    resource: ["invoice"],
    operation: ["create"],
  }),
  currency({ resource: ["invoice"], operation: ["create"] }),
  {
    displayName: "Line Items",
    name: "lineItems",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    default: {},
    displayOptions: { show: { resource: ["invoice"], operation: ["create"] } },
    options: [
      {
        name: "item",
        displayName: "Item",
        values: [
          { displayName: "Description", name: "description", type: "string", default: "" },
          { displayName: "Quantity", name: "quantity", type: "number", default: 1 },
          { displayName: "Unit Amount (Cents)", name: "unit_amount_cents", type: "number", default: 0 },
        ],
      },
    ],
  },
  {
    displayName: "Due At",
    name: "dueAt",
    type: "dateTime",
    default: "",
    displayOptions: { show: { resource: ["invoice"], operation: ["create"] } },
  },
  {
    displayName: "Description",
    name: "description",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["invoice"], operation: ["create"] } },
  },
  metadata({ resource: ["invoice"], operation: ["create"] }),
  picker("invoiceId", "Invoice", "searchInvoices", {
    resource: ["invoice"],
    operation: ["get", "finalize", "send", "void"],
  }),
  {
    displayName: "Status",
    name: "status",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["invoice"], operation: ["list"] } },
  },
  {
    displayName: "Limit",
    name: "perPage",
    type: "number",
    default: 25,
    typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ["invoice"], operation: ["list"] } },
  },
];

const product: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "create",
    displayOptions: { show: { resource: ["product"] } },
    options: [
      { name: "Create a Product", value: "create", action: "Create a product" },
      { name: "Get a Product", value: "get", action: "Get a product" },
      { name: "List Products", value: "list", action: "List products" },
      { name: "Update a Product", value: "update", action: "Update a product" },
    ],
  },
  {
    displayName: "Name",
    name: "name",
    type: "string",
    default: "",
    required: true,
    displayOptions: { show: { resource: ["product"], operation: ["create"] } },
  },
  {
    displayName: "Name",
    name: "name",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["product"], operation: ["update"] } },
  },
  {
    displayName: "Description",
    name: "description",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["product"], operation: ["create", "update"] } },
  },
  metadata({ resource: ["product"], operation: ["create", "update"] }),
  picker("productId", "Product", "searchProducts", {
    resource: ["product"],
    operation: ["get", "update"],
  }),
];

const price: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "create",
    displayOptions: { show: { resource: ["price"] } },
    options: [
      { name: "Create a Price", value: "create", action: "Create a price" },
      { name: "Get a Price", value: "get", action: "Get a price" },
      { name: "List Prices", value: "list", action: "List prices" },
    ],
  },
  picker("productId", "Product", "searchProducts", {
    resource: ["price"],
    operation: ["create", "get", "list"],
  }),
  {
    displayName: "Unit Amount (Cents)",
    name: "unitAmountCents",
    type: "number",
    default: 0,
    required: true,
    displayOptions: { show: { resource: ["price"], operation: ["create"] } },
  },
  currency({ resource: ["price"], operation: ["create"] }),
  {
    displayName: "Interval",
    name: "interval",
    type: "options",
    default: "month",
    options: [
      { name: "Day", value: "day" },
      { name: "Week", value: "week" },
      { name: "Month", value: "month" },
      { name: "Year", value: "year" },
    ],
    displayOptions: { show: { resource: ["price"], operation: ["create"] } },
  },
  {
    displayName: "Price ID",
    name: "priceId",
    type: "string",
    default: "",
    required: true,
    displayOptions: { show: { resource: ["price"], operation: ["get"] } },
  },
];

const subscription: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "create",
    displayOptions: { show: { resource: ["subscription"] } },
    options: [
      { name: "Create a Subscription", value: "create", action: "Create a subscription" },
      { name: "Get a Subscription", value: "get", action: "Get a subscription" },
      { name: "List Subscriptions", value: "list", action: "List subscriptions" },
      { name: "Cancel a Subscription", value: "cancel", action: "Cancel a subscription" },
      { name: "Pause a Subscription", value: "pause", action: "Pause a subscription" },
      { name: "Resume a Subscription", value: "resume", action: "Resume a subscription" },
    ],
  },
  picker("customerId", "Customer", "searchCustomers", {
    resource: ["subscription"],
    operation: ["create"],
  }),
  {
    displayName: "Price ID",
    name: "priceId",
    type: "string",
    default: "",
    required: true,
    displayOptions: { show: { resource: ["subscription"], operation: ["create"] } },
  },
  metadata({ resource: ["subscription"], operation: ["create"] }),
  picker("subscriptionId", "Subscription", "searchSubscriptions", {
    resource: ["subscription"],
    operation: ["get", "cancel", "pause", "resume"],
  }),
  {
    displayName: "Limit",
    name: "perPage",
    type: "number",
    default: 25,
    typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ["subscription"], operation: ["list"] } },
  },
];

const payout: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "create",
    displayOptions: { show: { resource: ["payout"] } },
    options: [
      { name: "Create a Payout", value: "create", action: "Create a payout" },
      { name: "Get a Payout", value: "get", action: "Get a payout" },
      { name: "List Payouts", value: "list", action: "List payouts" },
      { name: "Quote a Payout", value: "quote", action: "Quote a payout" },
    ],
  },
  {
    displayName: "Asset",
    name: "assetId",
    type: "options",
    typeOptions: { loadOptionsMethod: "getAssets" },
    default: "",
    required: true,
    displayOptions: { show: { resource: ["payout"], operation: ["create", "quote"] } },
  },
  {
    displayName: "Amount (Atomic)",
    name: "amountAtomic",
    type: "string",
    default: "",
    required: true,
    description: "Amount in the asset's smallest unit (atomic)",
    displayOptions: { show: { resource: ["payout"], operation: ["create", "quote"] } },
  },
  {
    displayName: "Destination Address",
    name: "destinationAddress",
    type: "string",
    default: "",
    description: "Crypto destination address (or use a saved payout detail id below)",
    displayOptions: { show: { resource: ["payout"], operation: ["create"] } },
  },
  {
    displayName: "Crypto Payout Detail ID",
    name: "cryptoPayoutDetailId",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["payout"], operation: ["create"] } },
  },
  {
    displayName: "Fiat Payout Detail ID",
    name: "fiatPayoutDetailId",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["payout"], operation: ["create", "quote"] } },
  },
  {
    displayName: "Payout ID",
    name: "payoutId",
    type: "string",
    default: "",
    required: true,
    displayOptions: { show: { resource: ["payout"], operation: ["get"] } },
  },
  {
    displayName: "Limit",
    name: "perPage",
    type: "number",
    default: 25,
    typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ["payout"], operation: ["list"] } },
  },
];

const balance: INodeProperties[] = [
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "list",
    displayOptions: { show: { resource: ["balance"] } },
    options: [{ name: "Get Balances", value: "list", action: "Get balances" }],
  },
];

export const properties: INodeProperties[] = [
  resource,
  ...payment,
  ...customer,
  ...invoice,
  ...product,
  ...price,
  ...subscription,
  ...payout,
  ...balance,
];
