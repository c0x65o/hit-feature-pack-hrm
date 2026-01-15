'use client';

import React, { useMemo } from 'react';
import { useServerDataTableState, useUi } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataTableColumns } from './entityTable';
import type { EmbeddedTableSpec } from './EmbeddedEntityTable';

function readParentField(spec: EmbeddedTableSpec, parent: any, queryKey: string): string | null {
  const q = (spec?.query || {}) as any;
  const m = q?.[queryKey];
  if (!m || typeof m !== 'object') return null;
  const vf = m.valueFrom;
  if (!vf || vf.kind !== 'parentField') return null;
  const field = String(vf.field || '').trim();
  if (!field) return null;
  const v = parent?.[field];
  const s = v == null ? '' : String(v).trim();
  return s || null;
}

export function HrmEmployeesEmbeddedTable({
  spec,
  parent,
  navigate,
}: {
  spec: EmbeddedTableSpec;
  parent: any;
  navigate: (path: string) => void;
}) {
  const { Card, DataTable, Spinner } = useUi();

  const managerId = readParentField(spec, parent, 'managerId') || String(parent?.id || '').trim();
  const employeeUiSpec = useEntityUiSpec('hrm.employee');
  const employeeListSpec = (employeeUiSpec as any)?.list || null;
  const routes = (employeeUiSpec as any)?.meta?.routes || {};

  const tableId = String(spec.tableId || employeeListSpec?.tableId || 'hrm.directReports');
  const serverTable = useServerDataTableState({
    tableId,
    pageSize: Number(spec.pageSize || employeeListSpec?.pageSize || 25),
    initialSort: (spec.initialSort as any) || (employeeListSpec?.initialSort as any) || { sortBy: 'lastName', sortOrder: 'asc' },
    sortWhitelist: Array.isArray(spec.sortWhitelist) ? spec.sortWhitelist : employeeListSpec?.sortWhitelist,
  });

  const [data, setData] = React.useState<any>({ items: [], pagination: { total: 0 } });
  const [loading, setLoading] = React.useState<boolean>(true);

  const fetchData = React.useCallback(async () => {
    if (!managerId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(serverTable.query.page));
      q.set('pageSize', String(serverTable.query.pageSize));
      q.set('managerId', managerId);
      if (serverTable.query.search) q.set('search', serverTable.query.search);
      if (serverTable.query.sortBy) q.set('sortBy', serverTable.query.sortBy);
      if (serverTable.query.sortOrder) q.set('sortOrder', serverTable.query.sortOrder);

      const res = await fetch(`/api/hrm/employees?${q.toString()}`);
      const json = res.ok ? await res.json() : null;
      setData({
        items: json?.items || [],
        pagination: json?.pagination || { total: 0 },
      });
    } finally {
      setLoading(false);
    }
  }, [
    managerId,
    serverTable.query.page,
    serverTable.query.pageSize,
    serverTable.query.search,
    serverTable.query.sortBy,
    serverTable.query.sortOrder,
  ]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const effectiveListSpec = useMemo(() => {
    if (Array.isArray(spec.columns) && spec.columns.length > 0) {
      const cols = spec.columns.map((c) => (typeof c === 'string' ? { key: c } : c));
      return { ...(employeeListSpec || {}), columns: cols };
    }
    return employeeListSpec || { columns: [] };
  }, [spec.columns, employeeListSpec]);

  const columns = useEntityDataTableColumns({
    listSpec: effectiveListSpec as any,
    fieldsMap: (employeeUiSpec as any)?.fields || null,
    isMobile: false,
  });

  const title = String(spec.title || 'Direct Reports');
  const emptyMessage = String(spec.emptyMessage || 'No direct reports yet.');
  const detailTpl = String(routes?.detail || '/hrm/employees/{id}');

  if (!employeeUiSpec) return <Spinner />;

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        emptyMessage={emptyMessage}
        onRowClick={(row: Record<string, unknown>) => {
          const id = String((row as any).id || '');
          if (!id) return;
          navigate(detailTpl.replace('{id}', encodeURIComponent(id)));
        }}
        onRefresh={fetchData}
        refreshing={loading}
        total={Number(data?.pagination?.total || 0)}
        {...serverTable.dataTable}
        searchDebounceMs={400}
        enableViews={true}
        showColumnVisibility={true}
      />
    </Card>
  );
}
