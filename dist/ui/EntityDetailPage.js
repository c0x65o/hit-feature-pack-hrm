'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useAlertDialog } from '@hit/ui-kit/hooks/useAlertDialog';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { EntityDetailBody } from './EntityDetailBody';
import { getEntityActionHandler } from './entityActions';
export function EntityDetailPage({ entityKey, id, onNavigate, }) {
    const { Page, Button, Alert, Spinner, AlertDialog } = useUi();
    const alertDialog = useAlertDialog();
    const uiSpec = useEntityUiSpec(entityKey);
    const ds = useEntityDataSource(entityKey);
    const [actionLoading, setActionLoading] = useState({});
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    if (!uiSpec)
        return _jsx(Spinner, {});
    if (!ds?.useDetail) {
        return (_jsxs(Alert, { variant: "error", title: `Missing data source for ${entityKey}`, children: ["No detail data source is registered for `", entityKey, "`."] }));
    }
    const { record, loading, refetch } = ds.useDetail({ id });
    if (loading)
        return _jsx(Spinner, {});
    if (!record) {
        return (_jsx(Alert, { variant: "error", title: "Not found", children: "The record you\u2019re looking for doesn\u2019t exist." }));
    }
    const meta = uiSpec?.meta || {};
    const routes = meta?.routes || {};
    const actionsMeta = meta?.actions || {};
    const titleSingular = String(meta.titleSingular || entityKey);
    const title = String(record?.preferredName || record?.name || `${titleSingular}`);
    const editHref = routes.edit ? String(routes.edit).replace('{id}', encodeURIComponent(String(record.id))) : null;
    const editLabel = String(actionsMeta.editLabel || `Edit ${titleSingular}`);
    const detailActionsSpec = Array.isArray(meta?.detailActions) ? meta.detailActions : [];
    const passesWhen = (whenAny) => {
        if (!whenAny || typeof whenAny !== 'object')
            return true;
        const field = String(whenAny.field || '').trim();
        if (!field)
            return true;
        const value = record?.[field];
        if ('eq' in whenAny)
            return value === whenAny.eq;
        if ('neq' in whenAny)
            return value !== whenAny.neq;
        if ('in' in whenAny && Array.isArray(whenAny.in))
            return whenAny.in.includes(value);
        if ('notIn' in whenAny && Array.isArray(whenAny.notIn))
            return !whenAny.notIn.includes(value);
        if ('exists' in whenAny)
            return whenAny.exists ? value != null : value == null;
        return true;
    };
    const coerceAlertVariant = (v) => {
        const s = String(v || '').trim().toLowerCase();
        if (s === 'error' || s === 'success' || s === 'warning' || s === 'info')
            return s;
        return undefined;
    };
    const renderDetailActions = useMemo(() => {
        if (!detailActionsSpec.length)
            return null;
        const nodes = [];
        for (const a of detailActionsSpec) {
            if (!a || typeof a !== 'object')
                continue;
            const kind = String(a.kind || '').trim();
            if (kind !== 'action')
                continue;
            if (!passesWhen(a.when))
                continue;
            const actionKey = String(a.actionKey || '').trim();
            if (!actionKey)
                continue;
            const handler = getEntityActionHandler(actionKey);
            if (!handler)
                continue;
            const label = String(a.label || actionKey);
            const variant = String(a.variant || 'secondary');
            const confirm = a.confirm && typeof a.confirm === 'object' ? a.confirm : null;
            const isBusy = Boolean(actionLoading[actionKey]);
            nodes.push(_jsx(Button, { variant: variant, size: "sm", loading: isBusy, disabled: isBusy, onClick: async () => {
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
                        const result = await handler({ entityKey, record, uiSpec, navigate, refetch });
                        if (result && typeof result === 'object') {
                            if (result.message) {
                                await alertDialog.showAlert(String(result.message), {
                                    title: String(result.title || 'Action completed'),
                                    variant: coerceAlertVariant(result.variant),
                                });
                            }
                            if (result.refresh !== false) {
                                await refetch?.();
                            }
                        }
                        else {
                            await refetch?.();
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
        return nodes.length ? _jsx("div", { className: "flex items-center gap-2", children: nodes }) : null;
    }, [detailActionsSpec, actionLoading, record, uiSpec, entityKey, navigate, refetch, alertDialog]);
    const actions = renderDetailActions || editHref ? (_jsxs("div", { className: "flex items-center gap-2", children: [renderDetailActions, editHref ? (_jsx(Button, { variant: "primary", size: "sm", onClick: () => navigate(editHref), children: editLabel })) : null] })) : null;
    return (_jsxs(Page, { title: title, breadcrumbs: Array.isArray(meta?.breadcrumbs) ? meta.breadcrumbs : undefined, onNavigate: navigate, actions: actions || undefined, children: [_jsx(EntityDetailBody, { entityKey: entityKey, uiSpec: uiSpec, record: record, navigate: navigate }), _jsx(AlertDialog, { ...alertDialog.props })] }));
}
