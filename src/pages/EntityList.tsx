'use client';

import React from 'react';
import { EntityListPage } from '../ui/EntityListPage';

export function EntityList({ entityKey, onNavigate }: { entityKey: string; onNavigate?: (path: string) => void }) {
  if (!entityKey) return <div style={{ padding: 16 }}>Missing required prop: entityKey</div>;
  return <EntityListPage entityKey={entityKey} onNavigate={onNavigate} />;
}

export default EntityList;

