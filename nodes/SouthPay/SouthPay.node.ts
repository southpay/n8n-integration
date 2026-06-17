import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from "n8n-workflow";

export class SouthPay implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SouthPay",
    name: "southPay",
    icon: "fa:credit-card",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "Create and read SouthPay crypto payments",
    defaults: { name: "SouthPay" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "southPayApi", required: true }],
    requestDefaults: {
      baseURL: "={{$credentials.baseUrl}}",
      headers: { accept: "application/json" },
    },
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "create",
        options: [
          {
            name: "Create Payment",
            value: "create",
            action: "Create a payment",
            routing: {
              request: {
                method: "POST",
                url: "/payments",
                body: {
                  payment_intent: {
                    amount: "={{$parameter.amount}}",
                    currency: "={{$parameter.currency}}",
                    order_id: "={{$parameter.orderId || undefined}}",
                    success_url: "={{$parameter.successUrl || undefined}}",
                    failed_url: "={{$parameter.failedUrl || undefined}}",
                  },
                },
              },
            },
          },
          {
            name: "Get Payment",
            value: "get",
            action: "Get a payment",
            routing: {
              request: {
                method: "GET",
                url: "=/payments/{{$parameter.paymentId}}",
              },
            },
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
        displayOptions: { show: { operation: ["get"] } },
      },
    ],
  };
}
