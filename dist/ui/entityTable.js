'use client';
import { useMemo } from 'react';
export function useEntityDataTableColumns({ listSpec, isMobile, customRenderers, }) {
    return useMemo(() => {
        const specColsAny = listSpec?.columns;
        const specCols = Array.isArray(specColsAny)
            ? specColsAny.filter((c) => c && typeof c === 'object' && c.key)
            : specColsAny && typeof specColsAny === 'object' && !Array.isArray(specColsAny)
                ? Object.entries(specColsAny).map(([key, val]) => ({
                    key: String(key),
                    ...(val && typeof val === 'object' && !Array.isArray(val) ? val : {}),
                }))
                : [];
        const cols = specCols.map((c) => ({
            key: String(c.key),
            label: String(c.label ?? c.key),
            sortable: c.sortable,
            hideable: c.hideable,
            align: c.align,
            width: c.width,
            filterType: c.filterType,
            reference: c.reference,
            render: customRenderers?.[String(c.key)],
        }));
        const mobileKeys = listSpec?.mobileColumnKeys;
        if (isMobile && Array.isArray(mobileKeys) && mobileKeys.length > 0) {
            const allow = new Set(mobileKeys.map((k) => String(k)));
            return cols.filter((c) => allow.has(String(c.key)));
        }
        return cols;
    }, [listSpec, isMobile, customRenderers]);
}
