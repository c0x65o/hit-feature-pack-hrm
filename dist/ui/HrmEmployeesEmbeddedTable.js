'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useMemo } from 'react';
import { useServerDataTableState, useUi } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataTableColumns } from './entityTable';
function readParentField(spec, parent, queryKey) {
    const q = (spec?.query || {});
    const m = q?.[queryKey];
    if (!m || typeof m !== 'object')
        return null;
    const vf = m.valueFrom;
    if (!vf || vf.kind !== 'parentField')
        return null;
    const field = String(vf.field || '').trim();
    if (!field)
        return null;
    const v = parent?.[field];
    const s = v == null ? '' : String(v).trim();
    return s || null;
}
function sortItems(items, sortBy, sortOrder) {
    const key = String(sortBy || '').trim();
    if (!key)
        return items;
    const dir = sortOrder === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
        const av = a?.[key];
        const bv = b?.[key];
        const as = av == null ? '' : String(av).toLowerCase();
        const bs = bv == null ? '' : String(bv).toLowerCase();
        if (as < bs)
            return -1 * dir;
        if (as > bs)
            return 1 * dir;
        return 0;
    });
}
function filterItemsBySearch(items, search) {
    const q = String(search || '').trim().toLowerCase();
    if (!q)
        return items;
    // Keep it simple: match common employee fields.
    return items.filter((x) => {
        const hay = [
            x?.userEmail,
            x?.firstName,
            x?.lastName,
            x?.preferredName,
        ]
            .filter((v) => v != null)
            .map((v) => String(v).toLowerCase());
        return hay.some((s) => s.includes(q));
    });
}
export function HrmEmployeesEmbeddedTable({ spec, parent, navigate, }) {
    const { Card, DataTable, Spinner } = useUi();
    const employeeId = String(parent?.id || '').trim();
    const managerId = readParentField(spec, parent, 'managerId') || employeeId;
    const employeeUiSpec = useEntityUiSpec('hrm.employee');
    const employeeListSpec = employeeUiSpec?.list || null;
    const routes = employeeUiSpec?.meta?.routes || {};
    const tableId = String(spec.tableId || employeeListSpec?.tableId || 'hrm.directReports');
    const serverTable = useServerDataTableState({
        tableId,
        pageSize: Number(spec.pageSize || employeeListSpec?.pageSize || 25),
        initialSort: spec.initialSort || employeeListSpec?.initialSort || { sortBy: 'lastName', sortOrder: 'asc' },
        sortWhitelist: Array.isArray(spec.sortWhitelist) ? spec.sortWhitelist : employeeListSpec?.sortWhitelist,
    });
    const [data, setData] = React.useState({ items: [], pagination: { total: 0 } });
    const [loading, setLoading] = React.useState(true);
    const fetchData = React.useCallback(async () => {
        if (!employeeId)
            return;
        setLoading(true);
        try {
            // NOTE: /api/hrm/employees is implemented by the app's schema CRUD handler in this app,
            // and it ignores managerId filtering. For direct reports we must use the dedicated endpoint.
            const res = await fetch(`/api/hrm/employees/${encodeURIComponent(employeeId)}/direct-reports`);
            const json = res.ok ? await res.json() : null;
            const raw = Array.isArray(json?.directReports) ? json.directReports : [];
            // Defensive: if bad data exists (self-manager), don't show the parent as its own report.
            const sanitized = raw.filter((x) => String(x?.id || '') !== employeeId);
            const searched = filterItemsBySearch(sanitized, serverTable.query.search || '');
            const sortBy = String(serverTable.query.sortBy || employeeListSpec?.initialSort?.sortBy || 'lastName');
            const sortOrder = String(serverTable.query.sortOrder || employeeListSpec?.initialSort?.sortOrder || 'asc') || 'asc';
            const sorted = sortItems(searched, sortBy, sortOrder);
            const page = Number(serverTable.query.page || 1);
            const pageSize = Number(serverTable.query.pageSize || 25);
            const start = (page - 1) * pageSize;
            const pageItems = sorted.slice(start, start + pageSize);
            setData({
                items: pageItems,
                pagination: { total: sorted.length },
            });
        }
        finally {
            setLoading(false);
        }
    }, [
        employeeId,
        serverTable.query.page,
        serverTable.query.pageSize,
        serverTable.query.search,
        serverTable.query.sortBy,
        serverTable.query.sortOrder,
        employeeListSpec?.initialSort?.sortBy,
        employeeListSpec?.initialSort?.sortOrder,
    ]);
    React.useEffect(() => {
        fetchData();
    }, [fetchData]);
    const effectiveListSpec = useMemo(() => {
        if (Array.isArray(spec.columns) && spec.columns.length > 0) {
            const cols = spec.columns.map((c) => (typeof c === 'string' ? { key: c } : c));
            return { ...(employeeListSpec || {}), columns: cols };
        }
        return employeeListSpec || { columns: [] };
    }, [spec.columns, employeeListSpec]);
    const columns = useEntityDataTableColumns({
        listSpec: effectiveListSpec,
        fieldsMap: employeeUiSpec?.fields || null,
        isMobile: false,
    });
    const title = String(spec.title || 'Direct Reports');
    const emptyMessage = String(spec.emptyMessage || 'No direct reports yet.');
    const detailTpl = String(routes?.detail || '/hrm/employees/{id}');
    if (!employeeUiSpec)
        return _jsx(Spinner, {});
    return (_jsxs(Card, { className: "mt-4", children: [_jsx("div", { className: "flex items-center justify-between mb-3", children: _jsx("h2", { className: "text-lg font-semibold", children: title }) }), _jsx(DataTable, { columns: columns, data: data?.items || [], loading: loading, emptyMessage: emptyMessage, onRowClick: (row) => {
                    const id = String(row.id || '');
                    if (!id)
                        return;
                    navigate(detailTpl.replace('{id}', encodeURIComponent(id)));
                }, onRefresh: fetchData, refreshing: loading, total: Number(data?.pagination?.total || 0), ...serverTable.dataTable, searchDebounceMs: 400, enableViews: true, showColumnVisibility: true })] }));
}
