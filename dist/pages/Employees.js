'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useServerDataTableState } from '@hit/ui-kit/hooks/useServerDataTableState';
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
    const { Page, Card, Button, DataTable, Modal, Input, Alert, Spinner } = useUi();
    const serverTable = useServerDataTableState({
        tableId: 'hrm.employees',
        pageSize: 25,
        initialSort: { sortBy: 'lastName', sortOrder: 'asc' },
        sortWhitelist: ['userEmail', 'firstName', 'lastName', 'preferredName', 'createdAt', 'updatedAt'],
    });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [mutating, setMutating] = useState(false);
    // edit form
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [preferredName, setPreferredName] = useState('');
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
    const openEdit = (row) => {
        setSelected(row);
        setFirstName(row.firstName || '');
        setLastName(row.lastName || '');
        setPreferredName(row.preferredName || '');
        setEditOpen(true);
    };
    const handleUpdate = async () => {
        if (!selected)
            return;
        try {
            setMutating(true);
            setError(null);
            const token = getStoredToken();
            if (!token)
                throw new Error('You must be signed in.');
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
            if (!res.ok)
                throw new Error(json?.error || json?.detail || 'Failed to update employee');
            setEditOpen(false);
            setSelected(null);
            await fetchEmployees();
        }
        catch (e) {
            setError(e?.message || 'Failed to update employee');
        }
        finally {
            setMutating(false);
        }
    };
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
            {
                key: 'actions',
                label: '',
                align: 'right',
                render: (_, row) => (_jsx("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                            e.stopPropagation();
                            openEdit(row);
                        }, children: _jsx(Edit2, { size: 16 }) }) })),
            },
        ];
    }, []);
    return (_jsxs(Page, { title: "Employees", description: "HRM employee directory (pre-1.0: identity + naming)", children: [error ? (_jsx(Alert, { variant: "error", title: "Error", children: error })) : null, _jsx(Card, { children: _jsx(DataTable, { columns: columns, data: items, loading: loading, emptyMessage: "No employees yet.", onRowClick: (row) => navigate(`/hrm/employees?selected=${encodeURIComponent(String(row.id || ''))}`), onRefresh: fetchEmployees, refreshing: loading, total: total, ...serverTable.dataTable, searchDebounceMs: 400, tableId: "hrm.employees", enableViews: true, showColumnVisibility: true }) }), editOpen && selected && (_jsx(Modal, { open: true, onClose: () => setEditOpen(false), title: "Edit Employee", children: _jsxs("div", { style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx(Input, { label: "User email", value: selected.userEmail, disabled: true }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsx(Input, { label: "First name", value: firstName, onChange: (e) => setFirstName(e.target.value) }), _jsx(Input, { label: "Last name", value: lastName, onChange: (e) => setLastName(e.target.value) })] }), _jsx(Input, { label: "Preferred name (optional)", value: preferredName, onChange: (e) => setPreferredName(e.target.value) }), _jsxs("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 }, children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                        setEditOpen(false);
                                        setSelected(null);
                                    }, children: "Cancel" }), _jsx(Button, { variant: "primary", onClick: handleUpdate, disabled: mutating, children: mutating ? 'Saving…' : 'Save' })] })] }) })), loading && !data ? (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: 16 }, children: _jsx(Spinner, {}) })) : null] }));
}
export default Employees;
