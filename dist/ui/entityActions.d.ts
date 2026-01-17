export type EntityActionResult = {
    title?: string;
    message?: string;
    variant?: 'success' | 'error' | 'warning' | 'info';
    refresh?: boolean;
};
export type EntityActionHandlerArgs = {
    entityKey: string;
    refetch?: () => Promise<any> | void;
};
export type EntityActionHandler = (args: EntityActionHandlerArgs) => void | EntityActionResult | Promise<void | EntityActionResult>;
export declare function getEntityActionHandler(handlerId: string): EntityActionHandler | undefined;
//# sourceMappingURL=entityActions.d.ts.map