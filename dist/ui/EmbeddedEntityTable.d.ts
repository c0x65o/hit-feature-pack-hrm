export type EmbeddedTableSpec = {
    kind: 'embeddedTable';
    title?: string;
    entityType: string;
    tableId?: string;
    pageSize?: number;
    initialSort?: {
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    };
    sortWhitelist?: string[];
    columns?: Array<string | {
        key: string;
        label?: string;
        sortable?: boolean;
        align?: 'left' | 'center' | 'right';
    }>;
    /** Query param mappings (server endpoints may have dedicated params like managerId) */
    query?: Record<string, {
        valueFrom: {
            kind: 'parentField';
            field: string;
        };
    }>;
    /** Optional create route template (may include `{parent.<field>}` tokens) */
    createRoute?: string;
    emptyMessage?: string;
};
export declare function EmbeddedEntityTable({ spec, parent, navigate, }: {
    spec: EmbeddedTableSpec;
    parent: any;
    navigate: (path: string) => void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=EmbeddedEntityTable.d.ts.map