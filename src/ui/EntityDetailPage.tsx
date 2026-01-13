'use client';

import React from 'react';
import { useUi } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { EntityDetailBody } from './EntityDetailBody';

export function EntityDetailPage({
  entityKey,
  id,
  onNavigate,
}: {
  entityKey: string;
  id: string;
  onNavigate?: (path: string) => void;
}) {
  const { Page, Button, Alert, Spinner } = useUi();
  const uiSpec = useEntityUiSpec(entityKey);
  const ds = useEntityDataSource(entityKey);

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

  const { record, loading } = ds.useDetail({ id });
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

  return (
    <Page
      title={title}
      breadcrumbs={Array.isArray(meta?.breadcrumbs) ? meta.breadcrumbs : undefined}
      onNavigate={navigate}
      actions={
        editHref ? (
          <Button variant="primary" onClick={() => navigate(editHref)}>
            {editLabel}
          </Button>
        ) : null
      }
    >
      <EntityDetailBody entityKey={entityKey} uiSpec={uiSpec} record={record} navigate={navigate} />
    </Page>
  );
}

