'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useServerDataTableState, useUi } from '@hit/ui-kit';
import { useAlertDialog } from '@hit/ui-kit/hooks/useAlertDialog';
import { useEntityDataTableColumns } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { getEntityActionHandler } from './entityActions';

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
  const { Page, Card, DataTable, Alert, Spinner, Button, AlertDialog } = useUi();
  const alertDialog = useAlertDialog();

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
  const headerActionsSpec: any[] = Array.isArray(meta?.headerActions) ? meta.headerActions : [];

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
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const columns = useEntityDataTableColumns({
    listSpec: listSpec as any,
    fieldsMap: (uiSpec as any)?.fields || null,
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

  const coerceAlertVariant = (v: unknown): 'error' | 'success' | 'warning' | 'info' | undefined => {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'error' || s === 'success' || s === 'warning' || s === 'info') return s;
    return undefined;
  };

  const renderSpecHeaderActions = () => {
    if (!Array.isArray(headerActionsSpec) || headerActionsSpec.length === 0) return null;
    const nodes: React.ReactNode[] = [];
    for (const a of headerActionsSpec) {
      if (!a || typeof a !== 'object') continue;
      const kind = String((a as any).kind || '').trim();
      if (kind !== 'action') continue;
      const actionKey = String((a as any).actionKey || '').trim();
      if (!actionKey) continue;
      const handler = getEntityActionHandler(actionKey);
      if (!handler) continue;
      const label = String((a as any).label || actionKey);
      const confirm = (a as any).confirm && typeof (a as any).confirm === 'object' ? (a as any).confirm : null;
      const isBusy = Boolean(actionLoading[actionKey]);
      nodes.push(
        <Button
          key={actionKey}
          variant="secondary"
          size="sm"
          loading={isBusy}
          disabled={isBusy}
          onClick={async () => {
            if (confirm) {
              const ok = await alertDialog.showConfirm(String(confirm.body || 'Are you sure?'), {
                title: String(confirm.title || 'Confirm'),
                variant: coerceAlertVariant((confirm as any).variant),
              });
              if (!ok) return;
            }
            setActionLoading((prev) => ({ ...(prev || {}), [actionKey]: true }));
            try {
              const result = await handler({ entityKey, refetch });
              if (result && typeof result === 'object') {
                if (result.message) {
                  await alertDialog.showAlert(String(result.message), {
                    title: String(result.title || 'Action completed'),
                    variant: coerceAlertVariant((result as any).variant),
                  });
                }
                if (result.refresh !== false) {
                  await refetch();
                }
              } else {
                await refetch();
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Action failed';
              await alertDialog.showAlert(String(msg), { title: 'Action Failed', variant: 'error' });
            } finally {
              setActionLoading((prev) => ({ ...(prev || {}), [actionKey]: false }));
            }
          }}
        >
          {label}
        </Button>
      );
    }
    return nodes.length > 0 ? <div className="flex items-center gap-2">{nodes}</div> : null;
  };

  const headerActions = renderSpecHeaderActions();

  return (
    <Page title={pageTitle} description={pageDescription} onNavigate={navigate} actions={headerActions || undefined}>
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
      <AlertDialog {...alertDialog.props} />
    </Page>
  );
}

