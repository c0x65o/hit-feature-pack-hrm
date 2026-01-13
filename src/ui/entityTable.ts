'use client';

import { useMemo } from 'react';

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
  initialSorting?: Array<{ id: string; desc?: boolean }>;
  sortWhitelist?: string[];
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

export function useEntityDataTableColumns({
  listSpec,
  fieldsMap,
  isMobile,
  customRenderers,
}: {
  listSpec: UiEntityListSpec | null;
  fieldsMap?: Record<string, any> | null;
  isMobile: boolean;
  customRenderers?: Record<string, DataTableColumn['render']>;
}) {
  return useMemo(() => {
    const specColsAny: any = listSpec?.columns;

    const specCols: ColumnSpec[] = Array.isArray(specColsAny)
      ? (specColsAny as any[])
          .map((c) => {
            if (typeof c === 'string') {
              const key = c.trim();
              return key ? ({ key } as ColumnSpec) : null;
            }
            if (c && typeof c === 'object' && (c as any).key) return c as ColumnSpec;
            return null;
          })
          .filter(Boolean) as ColumnSpec[]
      : specColsAny && typeof specColsAny === 'object' && !Array.isArray(specColsAny)
        ? Object.entries(specColsAny as Record<string, any>).map(([key, val]) => ({
            key: String(key),
            ...(val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, any>) : {}),
          }))
        : [];

    const sortAllow = new Set(
      Array.isArray((listSpec as any)?.sortWhitelist) ? ((listSpec as any).sortWhitelist as any[]).map((x) => String(x)) : []
    );

    const inferFilterType = (fieldType: string): ColumnSpec['filterType'] | undefined => {
      const t = String(fieldType || '').trim().toLowerCase();
      if (!t) return undefined;
      if (t === 'datetime' || t === 'date') return 'date';
      if (t === 'number' || t === 'currency' || t === 'int' || t === 'float' || t === 'decimal') return 'number';
      if (t === 'boolean' || t === 'bool') return 'boolean';
      if (t === 'select') return 'select';
      if (t === 'multiselect') return 'multiselect';
      if (t === 'reference') return 'autocomplete';
      return 'string';
    };

    const cols: DataTableColumn[] = specCols.map((c) => {
      const key = String(c.key);
      const fieldSpec: any = fieldsMap && typeof fieldsMap === 'object' ? (fieldsMap as any)[key] : null;
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

