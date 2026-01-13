'use client';

import React from 'react';
import { EntityUpsertPage } from '../ui/EntityUpsertPage';

export function EntityEdit({
  entityKey,
  id,
  onNavigate,
}: {
  entityKey: string;
  id: string;
  onNavigate?: (path: string) => void;
}) {
  if (!entityKey) return <div style={{ padding: 16 }}>Missing required prop: entityKey</div>;
  if (!id) return <div style={{ padding: 16 }}>Missing required prop: id</div>;
  return <EntityUpsertPage entityKey={entityKey} id={id} onNavigate={onNavigate} />;
}

export default EntityEdit;

