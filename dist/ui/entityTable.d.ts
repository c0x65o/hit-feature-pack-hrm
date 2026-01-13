type ColumnSpec = {
    key: string;
    label?: string;
    sortable?: boolean;
    hideable?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: string;
    filterType?: 'string' | 'number' | 'boolean' | 'date' | 'daterange' | 'select' | 'multiselect' | 'autocomplete';
    reference?: {
        entityType: string;
        detailPath?: string;
        labelFromRow?: string;
        idField?: string;
        linkable?: boolean;
    };
};
type UiEntityListSpec = {
    columns?: ColumnSpec[] | Record<string, any>;
    mobileColumnKeys?: string[];
    initialColumnVisibility?: Record<string, boolean>;
    initialSorting?: Array<{
        id: string;
        desc?: boolean;
    }>;
};
export type DataTableColumn = {
    key: string;
    label: string;
    sortable?: boolean;
    hideable?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: string;
    filterType?: any;
    reference?: any;
    render?: (value: unknown, row: Record<string, unknown>, index: number) => any;
};
export declare function useEntityDataTableColumns({ listSpec, isMobile, customRenderers, }: {
    listSpec: UiEntityListSpec | null;
    isMobile: boolean;
    customRenderers?: Record<string, DataTableColumn['render']>;
}): DataTableColumn[];
export {};
//# sourceMappingURL=entityTable.d.ts.map