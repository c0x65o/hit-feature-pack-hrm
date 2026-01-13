'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useUi } from '@hit/ui-kit';
import { useEntityUiSpec } from './useHitUiSpecs';
import { useEntityDataSource } from './entityDataSources';
import { EntityDetailBody } from './EntityDetailBody';
export function EntityDetailPage({ entityKey, id, onNavigate, }) {
    const { Page, Button, Alert, Spinner } = useUi();
    const uiSpec = useEntityUiSpec(entityKey);
    const ds = useEntityDataSource(entityKey);
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
    const { record, loading } = ds.useDetail({ id });
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
    return (_jsx(Page, { title: title, breadcrumbs: Array.isArray(meta?.breadcrumbs) ? meta.breadcrumbs : undefined, onNavigate: navigate, actions: editHref ? (_jsx(Button, { variant: "primary", onClick: () => navigate(editHref), children: editLabel })) : null, children: _jsx(EntityDetailBody, { entityKey: entityKey, uiSpec: uiSpec, record: record, navigate: navigate }) }));
}
