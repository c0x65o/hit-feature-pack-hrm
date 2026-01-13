'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { renderEntityFormField } from './renderEntityFormField';

function asRecord(v: unknown): Record<string, any> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as any) : null;
}

function trim(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

export function EntityUpsertPage({
  entityKey,
  id,
  onNavigate,
}: {
  entityKey: string;
  id: string;
  onNavigate?: (path: string) => void;
}) {
  const recordId = id === 'new' ? undefined : id;
  const uiSpec = useEntityUiSpec(entityKey);
  const ds = useEntityDataSource(entityKey);
  const { Page, Card, Button, Spinner, Alert, Input, Select, Autocomplete, TextArea, Checkbox } = useUi();

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  if (!uiSpec) return <Spinner />;
  if (!ds?.useUpsert) {
    return (
      <div style={{ padding: 16 }}>
        Missing data source registries for `{entityKey}`. Add `useUpsert` in `src/ui/entityDataSources.tsx`.
      </div>
    );
  }

  const upsert = ds.useUpsert({ id: recordId });
  const registries = ds.useFormRegistries ? ds.useFormRegistries() : { optionSources: {}, referenceRenderers: {} };

  const meta: any = (uiSpec as any)?.meta || {};
  const routes = meta?.routes || {};
  const actionsMeta: any = meta?.actions || {};
  const titleSingular = String(meta.titleSingular || entityKey);

  const formCfg = asRecord((uiSpec as any)?.form) || {};
  const sections = Array.isArray(formCfg.sections) ? formCfg.sections : [];
  const fieldsMap = asRecord((uiSpec as any)?.fields) || {};

  const scalarKeys = useMemo(() => {
    const out: string[] = [];
    for (const sAny of sections) {
      const s = asRecord(sAny);
      if (!s) continue;
      const fields = Array.isArray(s.fields) ? s.fields : [];
      for (const f of fields) {
        const k = trim(f);
        if (k) out.push(k);
      }
    }
    return Array.from(new Set(out));
  }, [sections]);

  useEffect(() => {
    if (!recordId) return;
    const rec = upsert?.record;
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return;
    const next: Record<string, string> = {};
    for (const k of scalarKeys) {
      const v = (rec as any)?.[k];
      next[k] = v == null ? '' : String(v);
    }
    setValues((prev) => ({ ...(prev || {}), ...next }));
  }, [recordId, upsert?.record, scalarKeys]);

  const isRequired = (k: string) => Boolean(asRecord(fieldsMap?.[k])?.required);

  const detailHrefForId = (rid: string) => {
    const tpl = String(routes.detail || `/${entityKey}/{id}`);
    return tpl.replace('{id}', encodeURIComponent(rid));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!recordId) {
      setError('Create is not supported for this entity.');
      return;
    }
    try {
      setSaving(true);
      // Build payload from scalar keys only.
      const payload: Record<string, any> = {};
      for (const k of scalarKeys) {
        const fs = asRecord(fieldsMap?.[k]) || {};
        if (fs.virtual) continue;
        const raw = (values?.[k] ?? '').toString();
        const t = String(fs.type || 'text').trim().toLowerCase();
        const v = raw.trim();
        if (!v) {
          payload[k] = null;
          continue;
        }
        if (t === 'number') {
          const n = Number(v);
          payload[k] = Number.isFinite(n) ? n : v;
          continue;
        }
        if (t === 'boolean') {
          payload[k] = v === 'true' || v === '1';
          continue;
        }
        payload[k] = v;
      }
      await upsert.update(recordId, payload);
      navigate(detailHrefForId(recordId));
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = recordId ? `Edit ${titleSingular}` : `New ${titleSingular}`;
  const cancelLabel = String(actionsMeta.cancelLabel || 'Cancel');
  const saveUpdateLabel = String(actionsMeta.saveUpdateLabel || `Save ${titleSingular}`);

  const onCancel = () => navigate(recordId ? detailHrefForId(recordId) : String(routes.list || '/'));

  return (
    <Page title={pageTitle} onNavigate={navigate}>
      {error ? (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      ) : null}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {sections.map((sAny, idx) => {
            const s = asRecord(sAny) || {};
            const title = s.title ? String(s.title) : '';
            const layoutCols = Number(asRecord(s.layout)?.columns || 1);
            const fields = Array.isArray(s.fields) ? s.fields.map(String).map((x) => x.trim()).filter(Boolean) : [];
            if (fields.length === 0) return null;
            const gridClass =
              layoutCols === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4';
            return (
              <div
                key={`sec-${idx}`}
                className={idx === 0 ? '' : 'border-t pt-6 mt-6'}
                style={idx === 0 ? undefined : { borderColor: 'var(--hit-border, #1f2937)' }}
              >
                {title ? <h3 className="text-lg font-semibold mb-4">{title}</h3> : null}
                <div className={gridClass}>
                  {fields.map((k) =>
                    renderEntityFormField({
                      keyName: k,
                      fieldSpec: fieldsMap?.[k] || {},
                      value: typeof values?.[k] === 'string' ? values[k] : '',
                      setValue: (v) => setValues((prev) => ({ ...(prev || {}), [k]: v })),
                      error: undefined,
                      required: isRequired(k),
                      ui: { Input, Select, Autocomplete, TextArea, Checkbox },
                      optionSources: registries.optionSources || {},
                      referenceRenderers: registries.referenceRenderers || {},
                    })
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-800">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              {cancelLabel}
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : saveUpdateLabel}
            </Button>
          </div>
        </form>
      </Card>
    </Page>
  );
}

