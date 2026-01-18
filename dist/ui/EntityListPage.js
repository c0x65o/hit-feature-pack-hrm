'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useServerDataTableState, useUi } from '@hit/ui-kit';
import { useAlertDialog } from '@hit/ui-kit/hooks/useAlertDialog';
import { useEntityDataTableColumns } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { getEntityActionHandler } from './entityActions';
export function EntityListPage({ entityKey, onNavigate, emptyMessage, }) {
    const { Page, Card, DataTable, Alert, Spinner, Button, AlertDialog } = useUi();
    const alertDialog = useAlertDialog();
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
    const headerActionsSpec = Array.isArray(meta?.headerActions) ? meta.headerActions : [];
    const actionsMeta = meta?.actions || {};
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
    const [actionLoading, setActionLoading] = useState({});
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
    const coerceAlertVariant = (v) => {
        const s = String(v || '').trim().toLowerCase();
        if (s === 'error' || s === 'success' || s === 'warning' || s === 'info')
            return s;
        return undefined;
    };
    const renderSpecHeaderActions = () => {
        if (!Array.isArray(headerActionsSpec) || headerActionsSpec.length === 0)
            return null;
        const nodes = [];
        for (const a of headerActionsSpec) {
            if (!a || typeof a !== 'object')
                continue;
            const kind = String(a.kind || '').trim();
            if (kind !== 'action')
                continue;
            const actionKey = String(a.actionKey || '').trim();
            if (!actionKey)
                continue;
            const handler = getEntityActionHandler(actionKey);
            if (!handler)
                continue;
            const label = String(a.label || actionKey);
            const confirm = a.confirm && typeof a.confirm === 'object' ? a.confirm : null;
            const isBusy = Boolean(actionLoading[actionKey]);
            nodes.push(_jsx(Button, { variant: "secondary", size: "sm", loading: isBusy, disabled: isBusy, onClick: async () => {
                    if (confirm) {
                        const ok = await alertDialog.showConfirm(String(confirm.body || 'Are you sure?'), {
                            title: String(confirm.title || 'Confirm'),
                            variant: coerceAlertVariant(confirm.variant),
                        });
                        if (!ok)
                            return;
                    }
                    setActionLoading((prev) => ({ ...(prev || {}), [actionKey]: true }));
                    try {
                        const result = await handler({ entityKey, refetch });
                        if (result && typeof result === 'object') {
                            if (result.message) {
                                await alertDialog.showAlert(String(result.message), {
                                    title: String(result.title || 'Action completed'),
                                    variant: coerceAlertVariant(result.variant),
                                });
                            }
                            if (result.refresh !== false) {
                                await refetch();
                            }
                        }
                        else {
                            await refetch();
                        }
                    }
                    catch (e) {
                        const msg = e instanceof Error ? e.message : 'Action failed';
                        await alertDialog.showAlert(String(msg), { title: 'Action Failed', variant: 'error' });
                    }
                    finally {
                        setActionLoading((prev) => ({ ...(prev || {}), [actionKey]: false }));
                    }
                }, children: label }, actionKey));
        }
        return nodes.length > 0 ? _jsx("div", { className: "flex items-center gap-2", children: nodes }) : null;
    };
    const allowCreate = actionsMeta?.allowCreate !== false;
    const createHref = routes?.new ? String(routes.new) : '';
    const createLabel = String(actionsMeta.createLabel || `New ${meta.titleSingular || entityKey}`);
    const createAction = createHref && allowCreate ? (_jsx(Button, { variant: "primary", size: "sm", onClick: () => navigate(createHref), children: createLabel })) : null;
    const specActions = renderSpecHeaderActions();
    const headerActions = createAction || specActions ? (_jsxs("div", { className: "flex items-center gap-2", children: [createAction, specActions] })) : null;
    return (_jsxs(Page, { title: pageTitle, description: pageDescription, onNavigate: navigate, actions: headerActions || undefined, children: [_jsx(Card, { children: _jsx(DataTable, { columns: columns, data: items, loading: loading, emptyMessage: emptyMessage || 'No items yet.', onRowClick: (row) => navigate(detailHref(String(row.id))), onRefresh: refetch, refreshing: loading, total: pagination?.total, ...serverTable.dataTable, searchDebounceMs: 400, tableId: tableId, uiStateKey: uiStateKey, enableViews: true, showColumnVisibility: true, initialColumnVisibility: effectiveInitialColumnVisibility, initialSorting: listSpec.initialSorting }) }), _jsx(AlertDialog, { ...alertDialog.props })] }));
}
