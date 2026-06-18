import { type IHookFunctions, type INodeType, type INodeTypeDescription, type IWebhookFunctions, type IWebhookResponseData } from "n8n-workflow";
export declare class SouthPayTrigger implements INodeType {
    description: INodeTypeDescription;
    webhookMethods: {
        default: {
            checkExists(this: IHookFunctions): Promise<boolean>;
            create(this: IHookFunctions): Promise<boolean>;
            delete(this: IHookFunctions): Promise<boolean>;
        };
    };
    webhook(this: IWebhookFunctions): Promise<IWebhookResponseData>;
}
