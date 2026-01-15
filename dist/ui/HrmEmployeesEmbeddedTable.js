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
export function HrmEmployeesEmbeddedTable({ spec, parent, navigate, }) {
    const { Card, DataTable, Spinner } = useUi();
    const managerId = readParentField(spec, parent, 'managerId') || String(parent?.id || '').trim();
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
        if (!managerId)
            return;
        setLoading(true);
        try {
            const q = new URLSearchParams();
            q.set('page', String(serverTable.query.page));
            q.set('pageSize', String(serverTable.query.pageSize));
            q.set('managerId', managerId);
            if (serverTable.query.search)
                q.set('search', serverTable.query.search);
            if (serverTable.query.sortBy)
                q.set('sortBy', serverTable.query.sortBy);
            if (serverTable.query.sortOrder)
                q.set('sortOrder', serverTable.query.sortOrder);
            const res = await fetch(`/api/hrm/employees?${q.toString()}`);
            const json = res.ok ? await res.json() : null;
            setData({
                items: json?.items || [],
                pagination: json?.pagination || { total: 0 },
            });
        }
        finally {
            setLoading(false);
        }
    }, [
        managerId,
        serverTable.query.page,
        serverTable.query.pageSize,
        serverTable.query.search,
        serverTable.query.sortBy,
        serverTable.query.sortOrder,
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
