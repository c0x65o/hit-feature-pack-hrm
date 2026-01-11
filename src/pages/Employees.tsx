'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  // LDD fields (from org assignments)
  divisionName: string | null;
  departmentName: string | null;
  locationName: string | null;
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
  const { Page, Card, DataTable, Alert, Spinner } = useUi();

  const serverTable = useServerDataTableState({
    tableId: 'hrm.employees',
    pageSize: 25,
    initialSort: { sortBy: 'lastName', sortOrder: 'asc' },
    sortWhitelist: ['userEmail', 'firstName', 'lastName', 'preferredName', 'phone', 'city', 'state', 'country', 'divisionName', 'departmentName', 'locationName', 'createdAt', 'updatedAt'],
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: EmployeeRow[]; pagination?: { total?: number } } | null>(null);

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
      // Contact info (hidden by default)
      { key: 'phone', label: 'Phone', sortable: true, defaultHidden: true },
      { key: 'city', label: 'City', sortable: true, defaultHidden: true },
      { key: 'state', label: 'State', sortable: true, defaultHidden: true },
      { key: 'country', label: 'Country', sortable: true, defaultHidden: true },
      // LDD columns (hidden by default)
      { key: 'divisionName', label: 'Division', sortable: true, defaultHidden: true },
      { key: 'departmentName', label: 'Department', sortable: true, defaultHidden: true },
      { key: 'locationName', label: 'Location', sortable: true, defaultHidden: true },
    ];
  }, []);

  return (
    <Page
      title="Employees"
      description="HRM employee directory"
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

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <Spinner />
        </div>
      ) : null}
    </Page>
  );
}

export default Employees;
