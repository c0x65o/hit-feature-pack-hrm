'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useServerDataTableState } from '@hit/ui-kit/hooks/useServerDataTableState';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataTableColumns } from './entityTable';
import { useEntityDataSource } from './entityDataSources';

type ListSpec = {
  tableId?: string;
  uiStateVersion?: number | string;
  pageSize?: number;
  initialSort?: { sortBy?: string; sortOrder?: 'asc' | 'desc' };
  sortWhitelist?: string[];
  defaultVisibleOnly?: boolean;
  initialColumnVisibility?: Record<string, boolean>;
  initialSorting?: Array<{ id: string; desc?: boolean }>;
  columns?: any;
  mobileColumnKeys?: string[];
};

export function EntityListPage({
  entityKey,
  onNavigate,
  emptyMessage,
}: {
  entityKey: string;
  onNavigate?: (path: string) => void;
  emptyMessage?: string;
}) {
  const { Page, Card, DataTable, Alert, Spinner } = useUi();

  const uiSpec = useEntityUiSpec(entityKey);
  const dataSource = useEntityDataSource(entityKey);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(Boolean(mql.matches));
    onChange();
    try {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      // eslint-disable-next-line deprecation/deprecation
      mql.addListener(onChange);
      // eslint-disable-next-line deprecation/deprecation
      return () => mql.removeListener(onChange);
    }
  }, []);

  if (!uiSpec) return <Spinner />;

  const listSpec: ListSpec | null =
    (uiSpec as any)?.list && typeof (uiSpec as any).list === 'object' ? ((uiSpec as any).list as any) : null;
  if (!listSpec) {
    return (
      <Alert variant="error" title={`Missing ${entityKey} list spec`}>
        UI schema for `{entityKey}.list` is missing.
      </Alert>
    );
  }

  const meta: any = (uiSpec as any)?.meta || {};
  const pageTitle = String(meta.titlePlural || entityKey);
  const pageDescription = String(meta.descriptionPlural || '');

  const tableId = String(listSpec.tableId || entityKey);
  const uiStateVersion = String(listSpec.uiStateVersion || '').trim();
  const uiStateKey = uiStateVersion ? `${tableId}@v${uiStateVersion}` : tableId;

  const serverTable = useServerDataTableState({
    tableId,
    pageSize: Number(listSpec.pageSize || 25),
    initialSort: (listSpec.initialSort as any) || { sortBy: 'id', sortOrder: 'desc' },
    sortWhitelist: Array.isArray(listSpec.sortWhitelist) ? listSpec.sortWhitelist : undefined,
  });

  const effectiveUseList = dataSource?.useList as any;
  if (!effectiveUseList) {
    return (
      <Alert variant="error" title={`Missing data source for ${entityKey}`}>
        No list data source is registered for `{entityKey}`.
      </Alert>
    );
  }

  const { data, loading, refetch } = effectiveUseList({
    page: serverTable.query.page,
    pageSize: serverTable.query.pageSize,
    search: serverTable.query.search,
    filters: serverTable.query.filters,
    filterMode: serverTable.query.filterMode,
    sortBy: serverTable.query.sortBy,
    sortOrder: serverTable.query.sortOrder,
  });

  const items = data?.items || [];
  const pagination = data?.pagination;

  const columns = useEntityDataTableColumns({
    listSpec: listSpec as any,
    isMobile,
  });

  const effectiveInitialColumnVisibility = useMemo(() => {
    const init = listSpec.initialColumnVisibility || {};
    const mode = Boolean((listSpec as any).defaultVisibleOnly);
    if (!mode) return init;
    const vis: Record<string, boolean> = {};
    for (const c of columns || []) {
      const key = c?.key ? String(c.key) : '';
      if (!key) continue;
      vis[key] = init[key] === true;
    }
    return vis;
  }, [listSpec.initialColumnVisibility, (listSpec as any).defaultVisibleOnly, columns]);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const routes = meta?.routes || {};
  const detailHref = (id: string) =>
    String(routes.detail || `/${entityKey}/{id}`).replace('{id}', encodeURIComponent(id));

  return (
    <Page title={pageTitle} description={pageDescription} onNavigate={navigate}>
      <Card>
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage={emptyMessage || 'No items yet.'}
          onRowClick={(row: Record<string, unknown>) => navigate(detailHref(String((row as any).id)))}
          onRefresh={refetch}
          refreshing={loading}
          total={pagination?.total}
          {...serverTable.dataTable}
          searchDebounceMs={400}
          tableId={tableId}
          uiStateKey={uiStateKey}
          enableViews={true}
          showColumnVisibility={true}
          initialColumnVisibility={effectiveInitialColumnVisibility}
          initialSorting={listSpec.initialSorting}
        />
      </Card>
    </Page>
  );
}

