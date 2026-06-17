import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class SouthPayApi implements ICredentialType {
  name = "southPayApi";
  displayName = "SouthPay API";
  documentationUrl = "https://docs.southpay.io";
  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "A SouthPay secret key (sp_sk_...). Create one in the dashboard under Developers.",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.southpay.io/api/v2",
      description: "Override for local testing, for example http://localhost:3000/api/v2.",
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: "=Bearer {{$credentials.apiKey}}",
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/payments",
      qs: { limit: 1 },
    },
  };
}
