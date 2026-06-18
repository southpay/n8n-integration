import { type IExecuteFunctions, type ILoadOptionsFunctions, type INodeExecutionData, type INodeListSearchResult, type INodePropertyOptions, type INodeType, type INodeTypeDescription } from "n8n-workflow";
export declare class SouthPay implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getCurrencies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
            getAssets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
        };
        listSearch: {
            searchPayments(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult>;
            searchCustomers(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult>;
            searchInvoices(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult>;
            searchProducts(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult>;
            searchSubscriptions(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
