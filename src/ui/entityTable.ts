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
  isMobile,
  customRenderers,
}: {
  listSpec: UiEntityListSpec | null;
  isMobile: boolean;
  customRenderers?: Record<string, DataTableColumn['render']>;
}) {
  return useMemo(() => {
    const specColsAny: any = listSpec?.columns;

    const specCols: ColumnSpec[] = Array.isArray(specColsAny)
      ? (specColsAny as ColumnSpec[]).filter((c) => c && typeof c === 'object' && (c as any).key)
      : specColsAny && typeof specColsAny === 'object' && !Array.isArray(specColsAny)
        ? Object.entries(specColsAny as Record<string, any>).map(([key, val]) => ({
            key: String(key),
            ...(val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, any>) : {}),
          }))
        : [];

    const cols: DataTableColumn[] = specCols.map((c) => ({
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

