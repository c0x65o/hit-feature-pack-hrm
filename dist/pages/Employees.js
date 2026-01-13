'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useServerDataTableState } from '@hit/ui-kit';
function getStoredToken() {
    if (typeof document === 'undefined')
        return null;
    const match = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((cookie) => cookie.startsWith('hit_token='));
    if (match)
        return decodeURIComponent(match.split('=').slice(1).join('='));
    if (typeof localStorage !== 'undefined')
        return localStorage.getItem('hit_token');
    return null;
}
function displayName(row) {
    const preferred = String(row.preferredName || '').trim();
    if (preferred)
        return preferred;
    return `${row.firstName} ${row.lastName}`.trim();
}
export function Employees({ onNavigate }) {
    const { Page, Card, DataTable, Alert, Spinner } = useUi();
    const serverTable = useServerDataTableState({
        tableId: 'hrm.employees',
        pageSize: 25,
        initialSort: { sortBy: 'lastName', sortOrder: 'asc' },
        sortWhitelist: ['userEmail', 'firstName', 'lastName', 'preferredName', 'phone', 'city', 'state', 'country', 'divisionName', 'departmentName', 'locationName', 'createdAt', 'updatedAt'],
    });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const fetchEmployees = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in.');
            const qp = new URLSearchParams();
            qp.set('page', String(serverTable.query.page));
            qp.set('pageSize', String(serverTable.query.pageSize));
            if (serverTable.query.search)
                qp.set('search', String(serverTable.query.search));
            if (serverTable.query.sortBy)
                qp.set('sortBy', String(serverTable.query.sortBy));
            if (serverTable.query.sortOrder)
                qp.set('sortOrder', String(serverTable.query.sortOrder));
            const res = await fetch(`/api/hrm/employees?${qp.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to load employees');
            setData(json);
        }
        catch (e) {
            setError(e?.message || 'Failed to load employees');
            setData(null);
        }
        finally {
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
                render: (_, row) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column' }, children: [_jsx("span", { style: { fontWeight: 600 }, children: String(row.userEmail || '') }), _jsx("span", { style: { opacity: 0.75, fontSize: '0.85em' }, children: displayName(row) })] })),
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
    return (_jsxs(Page, { title: "Employees", description: "HRM employee directory", children: [error ? (_jsx(Alert, { variant: "error", title: "Error", children: error })) : null, _jsx(Card, { children: _jsx(DataTable, { columns: columns, data: items, loading: loading, emptyMessage: "No employees yet.", onRowClick: (row) => navigate(`/hrm/employees/${encodeURIComponent(String(row.id || ''))}`), onRefresh: fetchEmployees, refreshing: loading, total: total, ...serverTable.dataTable, searchDebounceMs: 400, tableId: "hrm.employees", enableViews: true, showColumnVisibility: true }) }), loading && !data ? (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: 16 }, children: _jsx(Spinner, {}) })) : null] }));
}
export default Employees;
