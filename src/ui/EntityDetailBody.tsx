'use client';

import React, { useMemo } from 'react';
import { Avatar, OrgChart, useEntityResolver, useUi } from '@hit/ui-kit';
import { splitLinkedEntityTabsExtra, wrapWithLinkedEntityTabsIfConfigured } from '@hit/feature-pack-form-core';
import { EmbeddedEntityTable, type EmbeddedTableSpec } from './EmbeddedEntityTable';
import { getHitPlatform } from './platformVisibility';

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

function formatDuration(value: unknown, unit?: string): string | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const ms = unit === 's' ? n * 1000 : n;
  if (ms === 0) return '0s';
  const absMs = Math.abs(ms);
  const sign = ms < 0 ? '-' : '';
  const units = [
    { label: 'd', ms: 86400000 },
    { label: 'h', ms: 3600000 },
    { label: 'm', ms: 60000 },
    { label: 's', ms: 1000 },
    { label: 'ms', ms: 1 },
  ];
  const parts: string[] = [];
  let remaining = absMs;
  for (const u of units) {
    if (remaining >= u.ms) {
      const count = Math.floor(remaining / u.ms);
      remaining = remaining % u.ms;
      parts.push(`${count}${u.label}`);
      if (parts.length >= 2) break;
    }
  }
  return parts.length > 0 ? sign + parts.join(' ') : '0s';
}

function DetailField({ uiSpec, record, fieldKey }: { uiSpec: any; record: any; fieldKey: string }) {
  const resolver = useEntityResolver();
  const fieldsMap = asRecord(uiSpec?.fields) || {};
  const spec = asRecord(fieldsMap[fieldKey]) || {};
  const type = String(spec.type || 'text');
  const label = String(spec.label || fieldKey);
  const raw = (record as any)?.[fieldKey];

  if (type === 'image') {
    const name = String(
      (record as any)?.preferredName ||
        (record as any)?.name ||
        (record as any)?.displayName ||
        `${(record as any)?.firstName || ''} ${(record as any)?.lastName || ''}`
    )
      .replace(/\s+/g, ' ')
      .trim();
    const src = raw == null ? '' : String(raw).trim();
    if (!src && !name) return null;
    return (
      <div key={fieldKey}>
        <div className="text-sm text-gray-400 mb-2">{label}</div>
        <Avatar name={name || label} src={src || undefined} size="lg" />
      </div>
    );
  }

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

  if (type === 'duration') {
    const formatted = formatDuration(raw, spec.unit);
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
  navigate,
}: {
  entityKey: string;
  uiSpec: any;
  record: any;
  navigate?: (path: string) => void;
}): React.ReactElement {
  const { Card, Tabs, Alert } = useUi();
  const detailSpec = asRecord(uiSpec?.detail) || {};
  const { linkedEntityTabs, extras } = splitLinkedEntityTabsExtra((detailSpec as any).extras);
  const summaryFields = useMemo(() => {
    const explicit = Array.isArray(detailSpec.summaryFields) ? detailSpec.summaryFields.map(String) : null;
    return explicit && explicit.length > 0 ? explicit : [];
  }, [detailSpec.summaryFields]);
  const platform = getHitPlatform();

  const renderExtraContent = (spec: Record<string, any>) => {
    const kind = String(spec?.kind || '');
    if (kind === 'embeddedTable') {
      if (!navigate) return null;
      return <EmbeddedEntityTable spec={spec as EmbeddedTableSpec} parent={record} navigate={navigate} />;
    }
    if (kind === 'orgChart') {
      return <OrgChart spec={spec} record={record} onNavigate={navigate} />;
    }
    return (
      <Alert variant="warning" title="Unsupported detail extra">
        No renderer is registered for `{kind}` yet.
      </Alert>
    );
  };

  const renderExtra = (spec: Record<string, any>, idx: number) => {
    const kind = String(spec?.kind || '');
    if (kind === 'tabs') {
      const tabsAny = Array.isArray(spec?.tabs) ? spec.tabs : [];
      const tabs = tabsAny
        .map((tab: any) => {
          const tabPlatforms = Array.isArray(tab?.platforms) ? tab.platforms.map(String) : [];
          if (tabPlatforms.length > 0 && !tabPlatforms.includes(platform)) return null;
          const contentSpec = asRecord(tab?.content) || {};
          return {
            id: String(tab?.id || tab?.value || ''),
            label: String(tab?.label || 'Tab'),
            content: renderExtraContent(contentSpec),
          };
        })
        .filter(Boolean) as Array<{ id?: string; label: string; content?: React.ReactNode }>;

      if (!tabs.length) return null;
      return <Tabs key={`extra-tabs-${idx}`} tabs={tabs} />;
    }

    return <div key={`extra-${idx}`}>{renderExtraContent(spec)}</div>;
  };

  const inner = (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold mb-4">{String(detailSpec.summaryTitle || 'Details')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaryFields.map((k) => (
            <DetailField key={`${entityKey}-${k}`} uiSpec={uiSpec} record={record} fieldKey={String(k)} />
          ))}
        </div>
      </Card>

      {extras
        .filter((x: unknown): x is Record<string, any> => Boolean(x) && typeof x === 'object')
        .map((x, idx) => renderExtra(x, idx))}
    </div>
  );

  return wrapWithLinkedEntityTabsIfConfigured({
    linkedEntityTabs,
    entityKey,
    record,
    navigate,
    overview: inner,
  });
}

