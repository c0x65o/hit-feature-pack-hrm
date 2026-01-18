'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { renderEntityFormField } from './renderEntityFormField';
import { getStoredToken } from './authToken';

function asRecord(v: unknown): Record<string, any> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as any) : null;
}

function trim(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useAnyActionPermission(keys: string[]): { allowed: boolean; loading: boolean } {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const keyList = useMemo(() => keys.map((k) => String(k || '').trim()).filter(Boolean), [keys]);
  const depKey = useMemo(() => keyList.join('|'), [keyList]);

  useEffect(() => {
    if (!keyList.length) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        for (const key of keyList) {
          const res = await fetch(`/api/auth/permissions/actions/check/${encodeURIComponent(key)}`, {
            headers: authHeaders(),
            credentials: 'include',
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && Boolean((json as any)?.has_permission)) {
            if (!cancelled) setAllowed(true);
            return;
          }
        }
        if (!cancelled) setAllowed(false);
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [depKey, keyList]);

  return { allowed, loading };
}

type OrgAssignmentState = {
  id: string | null;
  divisionId: string;
  departmentId: string;
  locationId: string;
};

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
  const [orgAssignment, setOrgAssignment] = useState<OrgAssignmentState | null>(null);
  const [orgAssignmentDirty, setOrgAssignmentDirty] = useState(false);
  const [orgAssignmentLoading, setOrgAssignmentLoading] = useState(false);
  const [orgAssignmentError, setOrgAssignmentError] = useState<string | null>(null);
  const [orgAssignmentHasMultiple, setOrgAssignmentHasMultiple] = useState(false);
  const [orgOptions, setOrgOptions] = useState<{
    divisions: Array<{ id: string; name: string }>;
    departments: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
  }>({ divisions: [], departments: [], locations: [] });
  const [orgOptionsLoading, setOrgOptionsLoading] = useState(false);

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

  const userEmail = trim((upsert?.record as any)?.userEmail || values?.userEmail);

  const orgAssignmentWriteKeys = useMemo(
    () => [
      'auth-core.assignments.write.scope.all',
      'auth-core.assignments.write.scope.division',
      'auth-core.assignments.write.scope.department',
      'auth-core.assignments.write.scope.location',
      'auth-core.assignments.write.scope.own',
    ],
    []
  );

  const { allowed: canEditOrgAssignment, loading: orgAssignmentPermissionLoading } =
    useAnyActionPermission(orgAssignmentWriteKeys);

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

  useEffect(() => {
    if (!recordId) return;
    if (!userEmail || !canEditOrgAssignment) {
      setOrgAssignment(null);
      setOrgAssignmentDirty(false);
      setOrgAssignmentHasMultiple(false);
      setOrgAssignmentError(null);
      setOrgAssignmentLoading(false);
      return;
    }
    let cancelled = false;
    setOrgAssignmentLoading(true);
    setOrgAssignmentError(null);
    (async () => {
      try {
        const res = await fetch(`/api/org/assignments?userKey=${encodeURIComponent(userEmail)}`, {
          headers: authHeaders(),
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || json?.detail || 'Failed to load org scope');
        }
        const items = Array.isArray(json?.items) ? json.items : [];
        const first = items[0] || null;
        if (!cancelled) {
          setOrgAssignmentHasMultiple(items.length > 1);
          setOrgAssignment(
            first
              ? {
                  id: first?.id ? String(first.id) : null,
                  divisionId: first.divisionId ? String(first.divisionId) : '',
                  departmentId: first.departmentId ? String(first.departmentId) : '',
                  locationId: first.locationId ? String(first.locationId) : '',
                }
              : {
                  id: null,
                  divisionId: '',
                  departmentId: '',
                  locationId: '',
                }
          );
          setOrgAssignmentDirty(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setOrgAssignmentError(err?.message || 'Failed to load org scope');
          setOrgAssignment(null);
        }
      } finally {
        if (!cancelled) setOrgAssignmentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId, userEmail, canEditOrgAssignment]);

  useEffect(() => {
    if (!canEditOrgAssignment) return;
    let cancelled = false;
    setOrgOptionsLoading(true);
    (async () => {
      try {
        const [divisionsRes, departmentsRes, locationsRes] = await Promise.all([
          fetch('/api/org/divisions?pageSize=500', { headers: authHeaders(), credentials: 'include' }),
          fetch('/api/org/departments?pageSize=500', { headers: authHeaders(), credentials: 'include' }),
          fetch('/api/org/locations?pageSize=500', { headers: authHeaders(), credentials: 'include' }),
        ]);
        const [divisionsJson, departmentsJson, locationsJson] = await Promise.all([
          divisionsRes.json().catch(() => ({})),
          departmentsRes.json().catch(() => ({})),
          locationsRes.json().catch(() => ({})),
        ]);
        if (cancelled) return;
        setOrgOptions({
          divisions: Array.isArray(divisionsJson?.items) ? divisionsJson.items : [],
          departments: Array.isArray(departmentsJson?.items) ? departmentsJson.items : [],
          locations: Array.isArray(locationsJson?.items) ? locationsJson.items : [],
        });
      } catch {
        if (!cancelled) {
          setOrgOptions({ divisions: [], departments: [], locations: [] });
        }
      } finally {
        if (!cancelled) setOrgOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditOrgAssignment]);

  const isRequired = (k: string) => Boolean(asRecord(fieldsMap?.[k])?.required);

  const detailHrefForId = (rid: string) => {
    const tpl = String(routes.detail || `/${entityKey}/{id}`);
    return tpl.replace('{id}', encodeURIComponent(rid));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const isCreate = !recordId;
    if (isCreate && !upsert?.create) {
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
      if (isCreate) {
        const created = await upsert.create?.(payload);
        const createdId = String(created?.id || created?.record?.id || '');
        if (createdId) {
          navigate(detailHrefForId(createdId));
        } else {
          navigate(String(routes.list || '/'));
        }
        return;
      }

      await upsert.update(recordId, payload);
      if (canEditOrgAssignment && orgAssignment && orgAssignmentDirty && userEmail) {
        const assignmentPayload = {
          divisionId: orgAssignment.divisionId || null,
          departmentId: orgAssignment.departmentId || null,
          locationId: orgAssignment.locationId || null,
        };
        if (orgAssignment.id) {
          const res = await fetch(`/api/org/assignments/${encodeURIComponent(orgAssignment.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            credentials: 'include',
            body: JSON.stringify(assignmentPayload),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(json?.error || json?.detail || 'Failed to update org scope');
          }
        } else if (assignmentPayload.divisionId || assignmentPayload.departmentId || assignmentPayload.locationId) {
          const res = await fetch('/api/org/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            credentials: 'include',
            body: JSON.stringify({ userKey: userEmail, ...assignmentPayload }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(json?.error || json?.detail || 'Failed to create org scope');
          }
          setOrgAssignment((prev) => {
            if (!prev) return prev;
            const newId = json?.id ? String(json.id) : null;
            return newId ? { ...prev, id: newId } : prev;
          });
        }
        setOrgAssignmentDirty(false);
      }
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
            const widget = String(s.widget || '').trim();
            const fields = Array.isArray(s.fields) ? s.fields.map(String).map((x) => x.trim()).filter(Boolean) : [];
            if (widget === 'orgAssignment') {
              if (!recordId || orgAssignmentPermissionLoading || !canEditOrgAssignment) {
                return null;
              }
              const gridClass = 'grid grid-cols-1 md:grid-cols-3 gap-4';
              const divisionOptions = [
                { value: '', label: '(No division)' },
                ...orgOptions.divisions.map((d) => ({ value: String(d.id), label: String(d.name || d.id) })),
              ];
              const departmentOptions = [
                { value: '', label: '(No department)' },
                ...orgOptions.departments.map((d) => ({ value: String(d.id), label: String(d.name || d.id) })),
              ];
              const locationOptions = [
                { value: '', label: '(No location)' },
                ...orgOptions.locations.map((l) => ({ value: String(l.id), label: String(l.name || l.id) })),
              ];
              return (
                <div
                  key={`sec-${idx}`}
                  className={idx === 0 ? '' : 'border-t pt-6 mt-6'}
                  style={idx === 0 ? undefined : { borderColor: 'var(--hit-border, #1f2937)' }}
                >
                  {title ? <h3 className="text-lg font-semibold mb-4">{title}</h3> : null}
                  {orgAssignmentError ? (
                    <Alert variant="error" title="Org Scope">
                      {orgAssignmentError}
                    </Alert>
                  ) : null}
                  {orgAssignmentHasMultiple ? (
                    <Alert variant="warning" title="Multiple assignments detected">
                      This editor updates the most recent assignment only.
                    </Alert>
                  ) : null}
                  {orgAssignmentLoading || orgOptionsLoading ? (
                    <div className="py-4">
                      <Spinner />
                    </div>
                  ) : orgAssignment ? (
                    <div className={gridClass}>
                      <Select
                        label="Division"
                        value={orgAssignment.divisionId}
                        onChange={(v: string | number) => {
                          setOrgAssignment((prev) => (prev ? { ...prev, divisionId: String(v) } : prev));
                          setOrgAssignmentDirty(true);
                        }}
                        options={divisionOptions}
                        disabled={saving || orgOptionsLoading}
                      />
                      <Select
                        label="Department"
                        value={orgAssignment.departmentId}
                        onChange={(v: string | number) => {
                          setOrgAssignment((prev) => (prev ? { ...prev, departmentId: String(v) } : prev));
                          setOrgAssignmentDirty(true);
                        }}
                        options={departmentOptions}
                        disabled={saving || orgOptionsLoading}
                      />
                      <Select
                        label="Location"
                        value={orgAssignment.locationId}
                        onChange={(v: string | number) => {
                          setOrgAssignment((prev) => (prev ? { ...prev, locationId: String(v) } : prev));
                          setOrgAssignmentDirty(true);
                        }}
                        options={locationOptions}
                        disabled={saving || orgOptionsLoading}
                      />
                    </div>
                  ) : null}
                </div>
              );
            }
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

