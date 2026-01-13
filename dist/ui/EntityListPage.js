'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useServerDataTableState, useUi } from '@hit/ui-kit';
import { useEntityDataTableColumns } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
export function EntityListPage({ entityKey, onNavigate, emptyMessage, }) {
    const { Page, Card, DataTable, Alert, Spinner } = useUi();
    const uiSpec = useEntityUiSpec(entityKey);
    const dataSource = useEntityDataSource(entityKey);
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
            return;
        const mql = window.matchMedia('(max-width: 640px)');
        const onChange = () => setIsMobile(Boolean(mql.matches));
        onChange();
        try {
            mql.addEventListener('change', onChange);
            return () => mql.removeEventListener('change', onChange);
        }
        catch {
            // eslint-disable-next-line deprecation/deprecation
            mql.addListener(onChange);
            // eslint-disable-next-line deprecation/deprecation
            return () => mql.removeListener(onChange);
        }
    }, []);
    if (!uiSpec)
        return _jsx(Spinner, {});
    const listSpec = uiSpec?.list && typeof uiSpec.list === 'object' ? uiSpec.list : null;
    if (!listSpec) {
        return (_jsxs(Alert, { variant: "error", title: `Missing ${entityKey} list spec`, children: ["UI schema for `", entityKey, ".list` is missing."] }));
    }
    const meta = uiSpec?.meta || {};
    const pageTitle = String(meta.titlePlural || entityKey);
    const pageDescription = String(meta.descriptionPlural || '');
    const tableId = String(listSpec.tableId || entityKey);
    const uiStateVersion = String(listSpec.uiStateVersion || '').trim();
    const uiStateKey = uiStateVersion ? `${tableId}@v${uiStateVersion}` : tableId;
    const serverTable = useServerDataTableState({
        tableId,
        pageSize: Number(listSpec.pageSize || 25),
        initialSort: listSpec.initialSort || { sortBy: 'id', sortOrder: 'desc' },
        sortWhitelist: Array.isArray(listSpec.sortWhitelist) ? listSpec.sortWhitelist : undefined,
    });
    const effectiveUseList = dataSource?.useList;
    if (!effectiveUseList) {
        return (_jsxs(Alert, { variant: "error", title: `Missing data source for ${entityKey}`, children: ["No list data source is registered for `", entityKey, "`."] }));
    }
    const { data, loading, refetch } = effectiveUseList({
        page: serverTable.query.page,
        pageSize: serverTable.query.pageSize,
        search: serverTable.query.search,
        filters: serverTable.query.filters,
        filterMode: serverTable.query.filterMode,
        sortBy: serverTable.query.sortBy,
        sortOrder: serverTable.query.sortOrder,
    });
    const items = data?.items || [];
    const pagination = data?.pagination;
    const columns = useEntityDataTableColumns({
        listSpec: listSpec,
        fieldsMap: uiSpec?.fields || null,
        isMobile,
    });
    const effectiveInitialColumnVisibility = useMemo(() => {
        const init = listSpec.initialColumnVisibility || {};
        const mode = Boolean(listSpec.defaultVisibleOnly);
        if (!mode)
            return init;
        const vis = {};
        for (const c of columns || []) {
            const key = c?.key ? String(c.key) : '';
            if (!key)
                continue;
            vis[key] = init[key] === true;
        }
        return vis;
    }, [listSpec.initialColumnVisibility, listSpec.defaultVisibleOnly, columns]);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const routes = meta?.routes || {};
    const detailHref = (id) => String(routes.detail || `/${entityKey}/{id}`).replace('{id}', encodeURIComponent(id));
    return (_jsx(Page, { title: pageTitle, description: pageDescription, onNavigate: navigate, children: _jsx(Card, { children: _jsx(DataTable, { columns: columns, data: items, loading: loading, emptyMessage: emptyMessage || 'No items yet.', onRowClick: (row) => navigate(detailHref(String(row.id))), onRefresh: refetch, refreshing: loading, total: pagination?.total, ...serverTable.dataTable, searchDebounceMs: 400, tableId: tableId, uiStateKey: uiStateKey, enableViews: true, showColumnVisibility: true, initialColumnVisibility: effectiveInitialColumnVisibility, initialSorting: listSpec.initialSorting }) }) }));
}
