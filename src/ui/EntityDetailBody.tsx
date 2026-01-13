'use client';

import React, { useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import { useEntityResolver } from '@hit/ui-kit';

function asRecord(v: unknown): Record<string, any> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as any) : null;
}

function formatLocalDateTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function DetailField({ uiSpec, record, fieldKey }: { uiSpec: any; record: any; fieldKey: string }) {
  const resolver = useEntityResolver();
  const fieldsMap = asRecord(uiSpec?.fields) || {};
  const spec = asRecord(fieldsMap[fieldKey]) || {};
  const type = String(spec.type || 'text');
  const label = String(spec.label || fieldKey);
  const raw = (record as any)?.[fieldKey];

  if (type === 'reference') {
    const ref = asRecord(spec.reference) || {};
    const entityType = String(ref.entityType || '').trim();
    const id = raw == null ? '' : String(raw).trim();
    if (!entityType || !id) return null;
    const text = resolver.getLabel(entityType, id) || id;
    return (
      <div key={fieldKey}>
        <div className="text-sm text-gray-400 mb-1">{label}</div>
        <div>{text}</div>
      </div>
    );
  }

  if (type === 'datetime' || type === 'date') {
    const formatted = formatLocalDateTime(raw);
    if (!formatted) return null;
    return (
      <div key={fieldKey}>
        <div className="text-sm text-gray-400 mb-1">{label}</div>
        <div>{formatted}</div>
      </div>
    );
  }

  if (raw == null || raw === '') return null;
  return (
    <div key={fieldKey}>
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div>{String(raw)}</div>
    </div>
  );
}

export function EntityDetailBody({
  entityKey,
  uiSpec,
  record,
}: {
  entityKey: string;
  uiSpec: any;
  record: any;
  navigate?: (path: string) => void;
}) {
  const { Card } = useUi();
  const detailSpec = asRecord(uiSpec?.detail) || {};
  const summaryFields = useMemo(() => {
    const explicit = Array.isArray(detailSpec.summaryFields) ? detailSpec.summaryFields.map(String) : null;
    return explicit && explicit.length > 0 ? explicit : [];
  }, [detailSpec.summaryFields]);

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4">{String(detailSpec.summaryTitle || 'Details')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaryFields.map((k) => (
          <DetailField key={`${entityKey}-${k}`} uiSpec={uiSpec} record={record} fieldKey={String(k)} />
        ))}
      </div>
    </Card>
  );
}

