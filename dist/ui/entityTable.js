'use client';
import { useMemo } from 'react';
export function useEntityDataTableColumns({ listSpec, fieldsMap, isMobile, customRenderers, }) {
    return useMemo(() => {
        const specColsAny = listSpec?.columns;
        const specCols = Array.isArray(specColsAny)
            ? specColsAny
                .map((c) => {
                if (typeof c === 'string') {
                    const key = c.trim();
                    return key ? { key } : null;
                }
                if (c && typeof c === 'object' && c.key)
                    return c;
                return null;
            })
                .filter(Boolean)
            : specColsAny && typeof specColsAny === 'object' && !Array.isArray(specColsAny)
                ? Object.entries(specColsAny).map(([key, val]) => ({
                    key: String(key),
                    ...(val && typeof val === 'object' && !Array.isArray(val) ? val : {}),
                }))
                : [];
        const sortAllow = new Set(Array.isArray(listSpec?.sortWhitelist) ? listSpec.sortWhitelist.map((x) => String(x)) : []);
        const inferFilterType = (fieldType) => {
            const t = String(fieldType || '').trim().toLowerCase();
            if (!t)
                return undefined;
            if (t === 'datetime' || t === 'date')
                return 'date';
            if (t === 'number' || t === 'currency' || t === 'int' || t === 'float' || t === 'decimal')
                return 'number';
            if (t === 'boolean' || t === 'bool')
                return 'boolean';
            if (t === 'select')
                return 'select';
            if (t === 'multiselect')
                return 'multiselect';
            if (t === 'reference')
                return 'autocomplete';
            return 'string';
        };
        const cols = specCols.map((c) => {
            const key = String(c.key);
            const fieldSpec = fieldsMap && typeof fieldsMap === 'object' ? fieldsMap[key] : null;
            const inferredLabel = fieldSpec && typeof fieldSpec === 'object' && fieldSpec.label != null ? String(fieldSpec.label) : key;
            const inferredSortable = sortAllow.size > 0 ? sortAllow.has(key) : undefined;
            const inferredFilter = fieldSpec && typeof fieldSpec === 'object' ? inferFilterType(String(fieldSpec.type || '')) : undefined;
            return {
                key,
                label: String(c.label ?? inferredLabel ?? key),
                sortable: c.sortable ?? inferredSortable,
                hideable: c.hideable,
                align: c.align,
                width: c.width,
                filterType: c.filterType ?? inferredFilter,
                reference: c.reference,
                render: customRenderers?.[key],
            };
        });
        const mobileKeys = listSpec?.mobileColumnKeys;
        if (isMobile && Array.isArray(mobileKeys) && mobileKeys.length > 0) {
            const allow = new Set(mobileKeys.map((k) => String(k)));
            return cols.filter((c) => allow.has(String(c.key)));
        }
        return cols;
    }, [listSpec, fieldsMap, isMobile, customRenderers]);
}
