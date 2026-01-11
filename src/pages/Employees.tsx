'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useServerDataTableState } from '@hit/ui-kit/hooks/useServerDataTableState';

interface EmployeesProps {
  onNavigate?: (path: string) => void;
}

type EmployeeRow = {
  id: string;
  userEmail: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function getStoredToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((cookie) => cookie.startsWith('hit_token='));
  if (match) return decodeURIComponent(match.split('=').slice(1).join('='));
  if (typeof localStorage !== 'undefined') return localStorage.getItem('hit_token');
  return null;
}

function displayName(row: EmployeeRow): string {
  const preferred = String(row.preferredName || '').trim();
  if (preferred) return preferred;
  return `${row.firstName} ${row.lastName}`.trim();
}

export function Employees({ onNavigate }: EmployeesProps) {
  const { Page, Card, Button, DataTable, Modal, Input, Alert, Spinner } = useUi();

  const serverTable = useServerDataTableState({
    tableId: 'hrm.employees',
    pageSize: 25,
    initialSort: { sortBy: 'lastName', sortOrder: 'asc' },
    sortWhitelist: ['userEmail', 'firstName', 'lastName', 'preferredName', 'createdAt', 'updatedAt'],
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: EmployeeRow[]; pagination?: { total?: number } } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<EmployeeRow | null>(null);
  const [mutating, setMutating] = useState(false);

  // edit form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const fetchEmployees = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in.');

      const qp = new URLSearchParams();
      qp.set('page', String(serverTable.query.page));
      qp.set('pageSize', String(serverTable.query.pageSize));
      if (serverTable.query.search) qp.set('search', String(serverTable.query.search));
      if (serverTable.query.sortBy) qp.set('sortBy', String(serverTable.query.sortBy));
      if (serverTable.query.sortOrder) qp.set('sortOrder', String(serverTable.query.sortOrder));

      const res = await fetch(`/api/hrm/employees?${qp.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.detail || 'Failed to load employees');
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load employees');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [serverTable.query.page, serverTable.query.pageSize, serverTable.query.search, serverTable.query.sortBy, serverTable.query.sortOrder]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const items = data?.items || [];
  const total = data?.pagination?.total;

  const openEdit = (row: EmployeeRow) => {
    setSelected(row);
    setFirstName(row.firstName || '');
    setLastName(row.lastName || '');
    setPreferredName(row.preferredName || '');
    setEditOpen(true);
  };


  const handleUpdate = async () => {
    if (!selected) return;
    try {
      setMutating(true);
      setError(null);
      const token = getStoredToken();
      if (!token) throw new Error('You must be signed in.');

      const res = await fetch(`/api/hrm/employees/${encodeURIComponent(selected.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({
          firstName,
          lastName,
          preferredName: preferredName || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.detail || 'Failed to update employee');

      setEditOpen(false);
      setSelected(null);
      await fetchEmployees();
    } catch (e: any) {
      setError(e?.message || 'Failed to update employee');
    } finally {
      setMutating(false);
    }
  };

  const columns = useMemo(() => {
    return [
      {
        key: 'userEmail',
        label: 'User',
        sortable: true,
        render: (_: unknown, row: Record<string, unknown>) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>{String((row as any).userEmail || '')}</span>
            <span style={{ opacity: 0.75, fontSize: '0.85em' }}>{displayName(row as any)}</span>
          </div>
        ),
      },
      { key: 'firstName', label: 'First', sortable: true },
      { key: 'lastName', label: 'Last', sortable: true },
      { key: 'preferredName', label: 'Preferred', sortable: true },
      {
        key: 'actions',
        label: '',
        align: 'right' as const,
        render: (_: unknown, row: Record<string, unknown>) => (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openEdit(row as any);
              }}
            >
              <Edit2 size={16} />
            </Button>
          </div>
        ),
      },
    ];
  }, []);

  return (
    <Page
      title="Employees"
      description="HRM employee directory (pre-1.0: identity + naming)"
    >
      {error ? (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      ) : null}

      <Card>
        <DataTable
          columns={columns as any}
          data={items as any}
          loading={loading}
          emptyMessage="No employees yet."
          onRowClick={(row: Record<string, unknown>) => navigate(`/hrm/employees/${encodeURIComponent(String((row as any).id || ''))}`)}
          onRefresh={fetchEmployees}
          refreshing={loading}
          total={total}
          {...serverTable.dataTable}
          searchDebounceMs={400}
          tableId="hrm.employees"
          enableViews={true}
          showColumnVisibility={true}
        />
      </Card>

      {/* Edit */}
      {editOpen && selected && (
        <Modal open={true} onClose={() => setEditOpen(false)} title="Edit Employee">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="User email" value={selected.userEmail} disabled />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="First name" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} />
              <Input label="Last name" value={lastName} onChange={(e: any) => setLastName(e.target.value)} />
            </div>
            <Input label="Preferred name (optional)" value={preferredName} onChange={(e: any) => setPreferredName(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditOpen(false);
                  setSelected(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUpdate} disabled={mutating}>
                {mutating ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <Spinner />
        </div>
      ) : null}
    </Page>
  );
}

export default Employees;

