'use client';

import React, { useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useAlertDialog } from '@hit/ui-kit/hooks/useAlertDialog';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { EntityDetailBody } from './EntityDetailBody';
import { getEntityActionHandler } from './entityActions';

export function EntityDetailPage({
  entityKey,
  id,
  onNavigate,
}: {
  entityKey: string;
  id: string;
  onNavigate?: (path: string) => void;
}) {
  const { Page, Button, Alert, Spinner, AlertDialog } = useUi();
  const alertDialog = useAlertDialog();
  const uiSpec = useEntityUiSpec(entityKey);
  const ds = useEntityDataSource(entityKey);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  if (!uiSpec) return <Spinner />;
  if (!ds?.useDetail) {
    return (
      <Alert variant="error" title={`Missing data source for ${entityKey}`}>
        No detail data source is registered for `{entityKey}`.
      </Alert>
    );
  }

  const { record, loading, refetch } = ds.useDetail({ id });
  if (loading) return <Spinner />;
  if (!record) {
    return (
      <Alert variant="error" title="Not found">
        The record you’re looking for doesn’t exist.
      </Alert>
    );
  }

  const meta: any = (uiSpec as any)?.meta || {};
  const routes = meta?.routes || {};
  const actionsMeta: any = meta?.actions || {};

  const titleSingular = String(meta.titleSingular || entityKey);
  const title = String((record as any)?.preferredName || (record as any)?.name || `${titleSingular}`);
  const editHref = routes.edit ? String(routes.edit).replace('{id}', encodeURIComponent(String((record as any).id))) : null;
  const editLabel = String(actionsMeta.editLabel || `Edit ${titleSingular}`);

  const detailActionsSpec: any[] = Array.isArray(meta?.detailActions) ? meta.detailActions : [];

  const passesWhen = (whenAny: any): boolean => {
    if (!whenAny || typeof whenAny !== 'object') return true;
    const field = String(whenAny.field || '').trim();
    if (!field) return true;
    const value = (record as any)?.[field];
    if ('eq' in whenAny) return value === (whenAny as any).eq;
    if ('neq' in whenAny) return value !== (whenAny as any).neq;
    if ('in' in whenAny && Array.isArray((whenAny as any).in)) return (whenAny as any).in.includes(value);
    if ('notIn' in whenAny && Array.isArray((whenAny as any).notIn)) return !(whenAny as any).notIn.includes(value);
    if ('exists' in whenAny) return (whenAny as any).exists ? value != null : value == null;
    return true;
  };

  const coerceAlertVariant = (v: unknown): 'error' | 'success' | 'warning' | 'info' | undefined => {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'error' || s === 'success' || s === 'warning' || s === 'info') return s;
    return undefined;
  };

  const renderDetailActions = useMemo(() => {
    if (!detailActionsSpec.length) return null;
    const nodes: React.ReactNode[] = [];
    for (const a of detailActionsSpec) {
      if (!a || typeof a !== 'object') continue;
      const kind = String((a as any).kind || '').trim();
      if (kind !== 'action') continue;
      if (!passesWhen((a as any).when)) continue;
      const actionKey = String((a as any).actionKey || '').trim();
      if (!actionKey) continue;
      const handler = getEntityActionHandler(actionKey);
      if (!handler) continue;
      const label = String((a as any).label || actionKey);
      const variant = String((a as any).variant || 'secondary') as any;
      const confirm = (a as any).confirm && typeof (a as any).confirm === 'object' ? (a as any).confirm : null;
      const isBusy = Boolean(actionLoading[actionKey]);
      nodes.push(
        <Button
          key={actionKey}
          variant={variant}
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
              const result = await handler({ entityKey, record, uiSpec, navigate, refetch });
              if (result && typeof result === 'object') {
                if ((result as any).message) {
                  await alertDialog.showAlert(String((result as any).message), {
                    title: String((result as any).title || 'Action completed'),
                    variant: coerceAlertVariant((result as any).variant),
                  });
                }
                if ((result as any).refresh !== false) {
                  await refetch?.();
                }
              } else {
                await refetch?.();
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
    return nodes.length ? <div className="flex items-center gap-2">{nodes}</div> : null;
  }, [detailActionsSpec, actionLoading, record, uiSpec, entityKey, navigate, refetch, alertDialog]);

  const actions =
    renderDetailActions || editHref ? (
      <div className="flex items-center gap-2">
        {renderDetailActions}
        {editHref ? (
          <Button variant="primary" size="sm" onClick={() => navigate(editHref)}>
            {editLabel}
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <Page
      title={title}
      breadcrumbs={Array.isArray(meta?.breadcrumbs) ? meta.breadcrumbs : undefined}
      onNavigate={navigate}
      actions={actions || undefined}
    >
      <EntityDetailBody entityKey={entityKey} uiSpec={uiSpec} record={record} navigate={navigate} />
      <AlertDialog {...alertDialog.props} />
    </Page>
  );
}

